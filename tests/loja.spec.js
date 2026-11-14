import { test, expect } from '@playwright/test';

// Movimento reduzido: o dial sintoniza sem a varredura inicial.
test.use({ reducedMotion: 'reduce' });

const CEP_PAULISTA = { cep: '01310-100', logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' };

function vigiarErros(page) {
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(e.message));
  return erros;
}

/** O ViaCEP é trocado por uma resposta fixa: os testes não dependem da internet. */
async function simularViaCep(page) {
  await page.route('https://viacep.com.br/**', (route) => {
    const cep = route.request().url().match(/ws\/(\d{8})/)?.[1];
    route.fulfill({ json: cep === '01310100' ? CEP_PAULISTA : { erro: true } });
  });
}

const titulo = (page) => page.locator('[data-estante-titulo]');
const dial = (page) => page.getByRole('slider', { name: 'Dial de gêneros' });

test.describe('Agulha Discos · radiola', () => {
  test('abre sintonizada em Bossa com Varanda no prato', async ({ page }) => {
    const erros = vigiarErros(page);
    await page.goto('/');
    await expect(titulo(page)).toHaveText('Bossa');
    await expect(dial(page)).toHaveAttribute('aria-valuetext', /Bossa/);
    await expect(page.locator('[data-titulo]')).toHaveText('Varanda');
    await expect(page.locator('.capa')).toHaveCount(3);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
    expect(erros).toEqual([]);
  });

  test('o dial troca de estação pelo teclado', async ({ page }) => {
    await page.goto('/');
    await dial(page).focus();
    await dial(page).press('ArrowRight');
    await expect(titulo(page)).toHaveText('Jazz');
    await expect(dial(page)).toHaveAttribute('aria-valuetext', 'Jazz, 970 quilohertz');
    await dial(page).press('End');
    await expect(titulo(page)).toHaveText('Eletrônica');
    await dial(page).press('Home');
    await expect(titulo(page)).toHaveText('Tudo');
    await expect(page.locator('.capa')).toHaveCount(24);
  });

  test('filtro de usados e busca em todas as estações', async ({ page }) => {
    await page.goto('/');
    await dial(page).press('Home');
    await page.locator('[data-estado]').getByRole('radio', { name: 'Novos' }).click();
    const novos = await page.locator('.capa').count();
    expect(novos).toBeGreaterThan(0);
    expect(novos).toBeLessThan(24);

    await page.locator('[data-estado]').getByRole('radio', { name: 'Todos' }).click();
    await page.getByRole('searchbox', { name: /Procurar/ }).fill('antena');
    await expect(titulo(page)).toContainText('Procura');
    // "Antena" é faixa de dois discos de estações diferentes.
    await expect(page.locator('.capa')).toHaveCount(2);
  });

  test('escolher um disco põe no prato e na sacola, com frete pelo CEP', async ({ page }) => {
    await simularViaCep(page);
    await page.goto('/');
    await dial(page).press('ArrowRight');
    const capa = page.locator('.capa__btn').first();
    const nome = await capa.locator('.capa__titulo').textContent();
    await capa.click();
    await expect(page.locator('[data-titulo]')).toHaveText(nome);
    await expect(page).toHaveURL(/#disco\/agl-\d{3}$/);

    await page.getByRole('button', { name: 'Pôr na sacola' }).click();
    await expect(page.locator('[data-aviso]')).toContainText(`${nome} foi para a sacola`);
    await expect(page.locator('[data-contador]')).toHaveText('1');

    await page.locator('.sacola-btn').click();
    const gaveta = page.locator('[data-carrinho]');
    await expect(gaveta.locator('.item')).toHaveCount(1);
    await gaveta.locator('#cep-gaveta').fill('01310100');
    await gaveta.getByRole('button', { name: 'Calcular' }).click();
    await expect(gaveta.locator('[data-frete-msg]')).toContainText('Bela Vista');
    await expect(gaveta.locator('[data-frete-opcoes] li')).toHaveCount(3);

    await gaveta.locator('#cep-gaveta').fill('99999999');
    await gaveta.getByRole('button', { name: 'Calcular' }).click();
    await expect(gaveta.locator('[data-frete-msg]')).toContainText('Não achamos esse CEP');
  });

  test('link direto de um disco sintoniza a estação dele', async ({ page }) => {
    await page.goto('/#disco/agl-023');
    await expect(page.locator('[data-titulo]')).toHaveText('Candeeiro');
    await expect(titulo(page)).toHaveText('Forró');
    await expect(page.locator('.capa.is-escolhida .capa__titulo')).toHaveText('Candeeiro');
  });

  test('estoque limita a quantidade', async ({ page }) => {
    await page.goto('/#disco/agl-008'); // cópia única
    await expect(page.locator('[data-estoque]')).toHaveText('Cópia única.');
    await expect(page.locator('[data-mais]')).toBeDisabled();
    await page.getByRole('button', { name: 'Pôr na sacola' }).click();
    await expect(page.locator('[data-levar]')).toBeDisabled();
    await expect(page.locator('[data-levar]')).toHaveText('Todas as cópias na sacola');
  });
});

test.describe('Agulha Discos · checkout', () => {
  test('sacola vazia manda de volta para a radiola', async ({ page }) => {
    await page.goto('/checkout.html');
    await expect(page.getByRole('heading', { name: 'Sua sacola está vazia' })).toBeVisible();
  });

  test('valida, preenche o endereço pelo CEP e fecha o pedido', async ({ page }) => {
    await simularViaCep(page);
    await page.goto('/#disco/agl-024');
    await page.getByRole('button', { name: 'Pôr na sacola' }).click();
    await page.goto('/checkout.html');

    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    await expect(page.locator('#erro-nome')).toContainText('nome e sobrenome');
    await expect(page.locator('[data-erro-geral]')).toContainText('Faltam alguns dados');

    await page.locator('#nome').fill('Marina Costa');
    await page.locator('#email').fill('marina@exemplo.com');
    await page.locator('#fone').fill('11987654321');
    await expect(page.locator('#fone')).toHaveValue('(11) 98765-4321');
    await page.locator('#cep').fill('01310100');
    await expect(page.locator('#rua')).toHaveValue('Avenida Paulista');
    await expect(page.locator('#uf')).toHaveValue('SP');
    await page.locator('#numero').fill('1000');
    await expect(page.locator('.frete-op')).toHaveCount(3);

    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    await expect(page.locator('[data-feito]')).toBeVisible();
    await expect(page.locator('[data-feito-titulo]')).toContainText('Obrigado, Marina');
    await expect(page.locator('[data-copia]')).toHaveValue(/^DEMONSTRACAO-AGULHA-DISCOS-AGL-/);

    // A sacola foi esvaziada depois do pedido.
    await page.goto('/');
    await expect(page.locator('[data-contador]')).toHaveText('0');
  });
});
