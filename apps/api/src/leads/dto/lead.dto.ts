import {
  Equals,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { LeadStage } from '@prisma/client';

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
  @MaxLength(25)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  employees?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  message?: string;

  // Consentimento LGPD obrigatório: precisa vir true (checkbox marcado).
  @Equals(true, { message: 'É necessário aceitar os termos para continuar.' })
  consent!: boolean;

  // Honeypot anti-bot: campo oculto no form. Se vier preenchido, é robô.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

// Atualização manual pelo operador (mini-CRM): avançar estágio, anotar e
// preencher a proposta comercial.
export class UpdateLeadDto {
  @IsOptional()
  @IsEnum(LeadStage, { message: 'Estágio inválido.' })
  stage?: LeadStage;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  proposalPlan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  proposalValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  proposalConditions?: string;

  // Reunião/call agendada: ISO string (ou string vazia para limpar).
  @IsOptional()
  @IsString()
  @MaxLength(40)
  meetingAt?: string;
}
