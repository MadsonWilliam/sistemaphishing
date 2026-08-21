import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';

// TEMPORÁRIO (diagnóstico de saída IPv4/IPv6 da VPS). Remover após usar.
@Roles(Role.SUPER_ADMIN)
@Controller('netcheck')
export class NetCheckController {
  private async probe(url: string): Promise<string> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(url, { signal: ac.signal });
      return (await r.text()).trim();
    } catch (e) {
      return 'ERRO: ' + ((e as Error)?.message ?? String(e));
    } finally {
      clearTimeout(t);
    }
  }

  @Get()
  async check() {
    const [ipv4, ipv6, preferred] = await Promise.all([
      this.probe('https://api.ipify.org'), // só IPv4 (A)
      this.probe('https://api6.ipify.org'), // só IPv6 (AAAA)
      this.probe('https://api64.ipify.org'), // o que a VPS preferir
    ]);
    return {
      ipv4_saida: ipv4,
      ipv6_saida: ipv6,
      preferido: preferred,
      nota:
        'Se "preferido" vier IPv6, a VPS sai por IPv6 e o SMTP para smtpi.kinghost.net (que tem AAAA) pode ir por IPv6.',
    };
  }
}
