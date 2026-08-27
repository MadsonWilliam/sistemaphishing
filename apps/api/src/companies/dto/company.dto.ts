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

// Edição de um usuário (cliente) pelo admin: trocar nome e/ou definir uma
// nova senha. Ambos opcionais — envia só o que quer alterar.
export class UpdateCompanyUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter ao menos 8 caracteres.' })
  password?: string;
}
