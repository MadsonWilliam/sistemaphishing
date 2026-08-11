import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PostClickBehavior } from '@prisma/client';

export class RecipientDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  department?: string;
}

export class CreateCampaignDto {
  @IsString()
  companyId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  templateId!: string;

  // ── Configuração pós-clique (por envio) ──
  @IsOptional()
  @IsEnum(PostClickBehavior)
  postClickBehavior?: PostClickBehavior;

  @IsOptional()
  @IsBoolean()
  showReportButton?: boolean;

  @IsOptional()
  @IsBoolean()
  microTraining?: boolean;

  @IsOptional()
  @IsUrl({ require_tld: false })
  landingRedirectUrl?: string;

  // Domínio próprio para os links (ex.: link.rsweb.net.br). Deve apontar para
  // a aplicação. Se vazio, usa o domínio base da plataforma.
  @IsOptional()
  @IsString()
  linkDomain?: string;

  // ── Gota-a-gota ──
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(604800)
  dripWindowSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  dripJitterSeconds?: number;

  @IsOptional()
  @IsISO8601()
  scheduledStartAt?: string;

  // ── Destinatários ──
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients!: RecipientDto[];
}

export class SendCampaignDto {
  // Pool de identidades de remetente para rotação por destinatário.
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  senderIdentityIds!: string[];
}
