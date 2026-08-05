import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { TemplateSector, TemplateTrigger } from '@prisma/client';

export class CreateTemplateDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(TemplateSector)
  sector!: TemplateSector;

  @IsEnum(TemplateTrigger)
  trigger!: TemplateTrigger;

  @IsInt()
  @Min(1)
  @Max(3)
  difficulty!: number;

  @IsString()
  @MinLength(2)
  subject!: string;

  // Corpo HTML com placeholders: {{nome}}, {{empresa}}, {{link}}, {{anexo}}
  @IsString()
  @MinLength(2)
  html!: string;

  @IsOptional()
  @IsString()
  landingHtml?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
