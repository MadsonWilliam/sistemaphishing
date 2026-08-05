import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSendingDomainDto {
  // domínio de envio, ex.: dominiolegal.com.br
  @Matches(/^(?!-)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/, {
    message: 'Domínio inválido.',
  })
  domain!: string;

  @IsString()
  @MinLength(1)
  smtpHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsBoolean()
  smtpSecure!: boolean;

  @IsString()
  @MinLength(1)
  smtpUsername!: string;

  @IsString()
  @MinLength(1)
  smtpPassword!: string;

  // Se informado, o domínio pertence a essa empresa; senão, é da plataforma.
  @IsOptional()
  @IsString()
  companyId?: string;
}

export class UpdateSendingDomainDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  smtpUsername?: string;

  // Só reencripta se enviada.
  @IsOptional()
  @IsString()
  @MinLength(1)
  smtpPassword?: string;
}

export class CreateSenderIdentityDto {
  // parte local do e-mail, ex.: "contas" -> contas@dominiolegal.com.br
  @Matches(/^[A-Za-z0-9._%+-]+$/, { message: 'Parte local inválida.' })
  localPart!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;
}

export class SendTestEmailDto {
  @IsString()
  senderIdentityId!: string;

  @IsEmail()
  toEmail!: string;
}
