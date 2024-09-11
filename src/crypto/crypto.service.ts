import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SignJWT,
  CompactEncrypt,
  importSPKI,
  importPKCS8,
  KeyLike,
  JWTPayload,
  compactDecrypt,
  jwtVerify,
} from 'jose';
import { readFileSync } from 'node:fs';

@Injectable()
export class CryptoService {
  private secret: Uint8Array;
  private issuer: string;
  private expiresIn: number;
  private publicKey: KeyLike | null = null;
  private privateKey: KeyLike | null = null;
  private static JWS_ALG: string = 'HS512';
  private static JWE_ALG: string = 'RSA-OAEP-512';
  private static JWE_ENC: string = 'A256GCM';

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (32 !== secret.length)
      throw new Error('The JWS secret key must be 32 bytes long.');
    this.secret = new TextEncoder().encode(secret);
    this.issuer = this.configService.get<string>('JWT_ISSUER');
    this.expiresIn =
      parseInt(this.configService.get<string>('JWT_EXPIRES_IN'));
  }

  private async getKeyPair() {
    const publicKey = readFileSync(
      this.configService.get<string>('JWT_RSA_PUBLIC_KEY_PATH'),
      { encoding: 'utf-8' },
    );
    const privateKey = readFileSync(
      this.configService.get<string>('JWT_RSA_PRIVATE_KEY_PATH'),
      { encoding: 'utf-8' },
    );
    this.privateKey = await importPKCS8(privateKey, CryptoService.JWE_ALG);
    this.publicKey = await importSPKI(publicKey, CryptoService.JWE_ALG);
  }

  private async loadKeysIfNull() {
    if (null === this.publicKey || null === this.privateKey)
      await this.getKeyPair();
  }

  async forgeJwe(payload: JWTPayload): Promise<string> {
    const now = new Date().getTime();
    console.log(new Date(now), new Date(now + this.expiresIn));
    const jws = await new SignJWT(payload)
      .setProtectedHeader({ alg: CryptoService.JWS_ALG })
      .setIssuedAt(now)
      .setIssuer(this.issuer)
      .setExpirationTime(now + this.expiresIn * 1000)
      .sign(this.secret);
    const encodedJws = new TextEncoder().encode(jws);

    await this.loadKeysIfNull();
    const jwe = await new CompactEncrypt(encodedJws)
      .setProtectedHeader({
        alg: CryptoService.JWE_ALG,
        enc: CryptoService.JWE_ENC,
      })
      .encrypt(this.publicKey);
    return jwe;
  }

  async verifyJwe(jwe: string): Promise<object> {
    await this.loadKeysIfNull();
    const { plaintext: encodedJws } = await compactDecrypt(
      jwe,
      this.privateKey,
      {
        keyManagementAlgorithms: [CryptoService.JWE_ALG],
        contentEncryptionAlgorithms: [CryptoService.JWE_ENC],
      },
    );
    const jws = new TextDecoder().decode(encodedJws);
    const { payload } = await jwtVerify(jws, this.secret, {
      issuer: this.issuer,
      algorithms: [CryptoService.JWS_ALG],
      maxTokenAge: this.expiresIn,
    });

    return payload;
  }
}
