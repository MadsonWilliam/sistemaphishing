import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// Enfileira um lote de e-mails em modo gota-a-gota (usado para testar o motor de
// disparo; na Sprint 2 o disparo vem das campanhas com tokens de rastreio).
export class DripTestDto {
  @IsString()
  senderIdentityId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  toEmails!: string[];

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  html!: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  // Janela (segundos) para espalhar os envios.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  windowSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  jitterSeconds?: number;
}
