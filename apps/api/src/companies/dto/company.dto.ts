import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  // Libera recorrência de campanha para o admin do cliente.
  @IsOptional()
  @IsBoolean()
  allowRecurrence?: boolean;

  // Admin inicial da empresa (recebe papel COMPANY_ADMIN).
  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(2)
  adminName!: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
