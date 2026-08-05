import { Injectable } from '@nestjs/common';
import { promises as dns } from 'dns';

export interface DnsCheck {
  ok: boolean;
  detail: string;
  record?: string;
}

// Checa a autenticação de e-mail (SPF/DKIM/DMARC) de um domínio via DNS.
// Bons registros reduzem drasticamente a chance de cair em spam.
@Injectable()
export class DeliverabilityService {
  private async txt(name: string): Promise<string[]> {
    try {
      const records = await dns.resolveTxt(name);
      // Cada registro TXT pode vir em pedaços; junta-os.
      return records.map((chunks) => chunks.join(''));
    } catch {
      return [];
    }
  }

  async check(domain: string, selector?: string) {
    const [domainTxt, dmarcTxt] = await Promise.all([
      this.txt(domain),
      this.txt(`_dmarc.${domain}`),
    ]);

    const spfRecord = domainTxt.find((r) => /v=spf1/i.test(r));
    const dmarcRecord = dmarcTxt.find((r) => /v=DMARC1/i.test(r));
    const dmarcPolicy = dmarcRecord
      ? (dmarcRecord.match(/p=(\w+)/i)?.[1] ?? 'none').toLowerCase()
      : null;

    const spf: DnsCheck = spfRecord
      ? { ok: true, detail: 'SPF presente.', record: spfRecord }
      : { ok: false, detail: 'SPF ausente.' };

    const dmarc: DnsCheck = dmarcRecord
      ? {
          ok: true,
          detail: `DMARC presente (política p=${dmarcPolicy}).`,
          record: dmarcRecord,
        }
      : { ok: false, detail: 'DMARC ausente.' };

    let dkim: DnsCheck;
    if (selector) {
      const dkimTxt = await this.txt(`${selector}._domainkey.${domain}`);
      const dk = dkimTxt.find((r) => /v=DKIM1|k=rsa|p=[A-Za-z0-9]/i.test(r));
      dkim = dk
        ? {
            ok: true,
            detail: `DKIM encontrado para o selector "${selector}".`,
            record: dk.slice(0, 60) + '…',
          }
        : {
            ok: false,
            detail: `Nenhum registro DKIM para o selector "${selector}".`,
          };
    } else {
      dkim = {
        ok: false,
        detail:
          'Informe o selector DKIM (?selector=) para checar — obtenha-o no painel do provedor de e-mail (ex.: uni5).',
      };
    }

    const recommendations: string[] = [];
    if (!spf.ok) {
      recommendations.push(
        `SPF ausente: crie um registro TXT em "${domain}" começando com "v=spf1", incluindo o servidor de envio (ex.: include do seu provedor) e terminando em "~all".`,
      );
    } else if (!/include:|a:|mx|ip4:|ip6:/i.test(spfRecord ?? '')) {
      recommendations.push(
        'SPF existe, mas confirme se ele autoriza o servidor de envio atual (o remetente precisa estar coberto).',
      );
    }
    if (!dmarc.ok) {
      recommendations.push(
        `DMARC ausente: crie TXT em "_dmarc.${domain}" com "v=DMARC1; p=none; rua=mailto:dmarc@${domain}" e evolua para quarantine/reject após validar SPF e DKIM.`,
      );
    } else if (dmarcPolicy === 'none') {
      recommendations.push(
        'DMARC está em p=none (só monitoramento). Depois de confirmar SPF e DKIM alinhados, suba para p=quarantine e então p=reject.',
      );
    }
    if (!dkim.ok) {
      recommendations.push(
        'Ative a assinatura DKIM no provedor de e-mail e verifique aqui informando o selector.',
      );
    }

    const passed = [spf.ok, dmarc.ok, dkim.ok].filter(Boolean).length;
    return {
      domain,
      score: `${passed}/3`,
      status: passed === 3 ? 'OK' : passed >= 1 ? 'PARCIAL' : 'CRITICO',
      spf,
      dkim,
      dmarc,
      recommendations,
    };
  }
}
