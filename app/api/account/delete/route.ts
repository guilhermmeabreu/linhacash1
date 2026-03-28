import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getIP } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function DELETE(req: Request) {
  // Rate limit: máx 3 tentativas por hora por IP
  if (!rateLimit(getIP(req), 3, 3600000)) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em 1 hora.' }, { status: 429 });
  }

  try {
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
    }

    // 1. Deleta dados do perfil
    await supabase.from('profiles').delete().eq('id', userId);

    // 2. Deleta usos de referral
    await supabase.from('referral_uses').delete().eq('user_id', userId);

    // 3. Deleta favoritos se existir
    await supabase.from('favorites').delete().eq('user_id', userId).throwOnError().then(() => {}).catch(() => {});

    // 4. Deleta o usuário do Supabase Auth
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error('Erro ao deletar usuário Auth:', error);
      return NextResponse.json({ error: 'Erro ao excluir conta.' }, { status: 500 });
    }

    // 5. Notifica admin
    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'LinhaCash <onboarding@resend.dev>',
          to: process.env.ADMIN_EMAIL,
          subject: '🗑️ Usuário solicitou exclusão de conta',
          html: `<p><strong>Email:</strong> ${email}</p><p><strong>ID:</strong> ${userId}</p><p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p><p>Todos os dados foram excluídos conforme LGPD Art. 18.</p>`
        })
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Erro ao excluir conta:', e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
