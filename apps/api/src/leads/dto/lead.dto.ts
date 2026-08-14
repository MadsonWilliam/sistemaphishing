import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Formulário público da landing. Campos curtos com limite de tamanho para
// evitar abuso; só nome, empresa e e-mail são obrigatórios.
export class CreateLeadDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome.' })
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe a empresa.' })
  @MaxLength(160)
  company!: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(180)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  employees?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  message?: string;

  // Honeypot anti-bot: campo oculto no form. Se vier preenchido, é robô.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
