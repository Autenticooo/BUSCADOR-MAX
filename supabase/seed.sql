-- ============================================================================
--  BUSCADOR MAX — produtos de exemplo (opcional)
-- ----------------------------------------------------------------------------
--  Rode DEPOIS de 0001_init.sql.
--  Idempotente: produtos com o mesmo nome não são duplicados.
--  max_score é deixado NULL de propósito para o trigger calcular sozinho.
-- ============================================================================

insert into public.products (
  nome, imagem, categoria, descricao, link_tiktok, pais,
  preco, comissao, gvm_max, videos_criadores, quantidade_criadores,
  status, estrategia, created_at
)
select
  v.nome, v.imagem, v.categoria, v.descricao, v.link_tiktok, v.pais,
  v.preco::numeric, v.comissao::numeric, v.gvm_max::numeric,
  v.videos_criadores, v.quantidade_criadores, v.status, v.estrategia,
  now() - (v.dias_atras || ' days')::interval
from (
  values
  ('Sérum Facial Vitamina C 30ml',
   'https://picsum.photos/seed/serum-vitc/600/600',
   'Beleza e Cuidados',
   'Sérum antioxidante com 20% de vitamina C pura e ácido hialurônico. Clareia manchas e uniformiza o tom da pele em 4 semanas. Textura leve, absorção rápida, sem oleosidade.',
   'https://shop.tiktok.com/view/product/1729384756',
   'BR', 89.90, 20, 480000, 412, 168, 'em_alta',
   'Antes e depois de 7 dias em vídeo curto. Comece com a dor (manchas de sol) e feche com o resultado no rosto limpo. CTA nos 3 primeiros segundos.',
   0),

  ('Mini Liquidificador Portátil USB',
   'https://picsum.photos/seed/mini-liquid/600/600',
   'Casa e Cozinha',
   'Liquidificador de 380ml recarregável por USB-C. Bateria para 15 ciclos, lâminas em inox 304 e copo livre de BPA. Ideal para academia e escritório.',
   'https://shop.tiktok.com/view/product/1729384757',
   'BR', 79.90, 18, 355000, 289, 121, 'em_alta',
   'Demonstração de uso real: vitamina em 20 segundos no carro ou academia. Mostre a limpeza fácil com água — é o comentário mais frequente.',
   0),

  ('Fone Bluetooth TWS Pro Cancelamento de Ruído',
   'https://picsum.photos/seed/fone-tws/600/600',
   'Eletrônicos',
   'Fone intra-auricular com ANC híbrido de 35dB, Bluetooth 5.3, 40h de bateria com case e resistência IPX5. Microfone duplo para chamadas.',
   'https://shop.tiktok.com/view/product/1729384758',
   'BR', 149.90, 15, 620000, 538, 214, 'em_alta',
   'Teste de ruído na rua com áudio original vs. ANC ligado. Comparativo de preço com marcas conhecidas sempre performa bem nessa categoria.',
   1),

  ('Cinta Modeladora Corporal Cintura Alta',
   'https://picsum.photos/seed/cinta-model/600/600',
   'Moda Feminina',
   'Cinta com 4 barbatanas flexíveis, tecido compressivo respirável e fecho triplo. Modela cintura e abdômen sem marcar na roupa.',
   'https://shop.tiktok.com/view/product/1729384759',
   'BR', 69.90, 25, 290000, 245, 96, 'ativo',
   'Prova social: vista a roupa justa antes e depois. Evite promessas de emagrecimento — foque no caimento da roupa.',
   1),

  ('Kit 3 Organizadores de Geladeira Acrílico',
   'https://picsum.photos/seed/organizador/600/600',
   'Casa e Cozinha',
   'Conjunto com 3 caixas transparentes empilháveis com tampa e alça. Mede 32x21x10cm cada. Facilita visualizar e reduzir desperdício.',
   'https://shop.tiktok.com/view/product/1729384760',
   'BR', 119.90, 16, 180000, 132, 61, 'ativo',
   'Vídeo satisfatório de organização em time-lapse. Feche mostrando a geladeira cheia vs. organizada.',
   2),

  ('Tênis Esportivo Ultraleve Corrida',
   'https://picsum.photos/seed/tenis-corrida/600/600',
   'Fitness',
   'Tênis com cabedal em knit respirável, entressola em EVA de alta recuperação e solado antiderrapante. Peso médio de 240g no tamanho 40.',
   'https://shop.tiktok.com/view/product/1729384761',
   'BR', 199.90, 14, 410000, 356, 143, 'em_alta',
   'Unboxing com teste de flexibilidade e corrida curta. Enfatize o peso leve na balança — gera muitos comentários.',
   0),

  ('Luminária LED RGB Gamer com Controle',
   'https://picsum.photos/seed/luminaria-rgb/600/600',
   'Eletrônicos',
   'Barra de luz LED com 16 milhões de cores, controle remoto e sincronização com música. Fixação adesiva sem furos, 50cm.',
   'https://shop.tiktok.com/view/product/1729384762',
   'US', 24.99, 22, 275000, 198, 88, 'ativo',
   'Setup tour em quarto escuro. Mostre a mudança de cor no beat da música — formato com alto replay.',
   3),

  ('Escova Alisadora Térmica Íon',
   'https://picsum.photos/seed/escova-termica/600/600',
   'Beleza e Cuidados',
   'Escova com revestimento cerâmico, 5 níveis de temperatura até 230°C e ionizador antifrizz. Aquece em 30 segundos.',
   'https://shop.tiktok.com/view/product/1729384763',
   'BR', 129.90, 19, 235000, 176, 74, 'ativo',
   'Metade do cabelo lisa, metade natural. Esse split screen é o gancho mais forte para a categoria.',
   2),

  ('Garrafa Térmica Inox 1L com Tampa Esportiva',
   'https://picsum.photos/seed/garrafa-termica/600/600',
   'Fitness',
   'Garrafa em aço inox 304 com parede dupla a vácuo. Mantém 24h frio e 12h quente. Tampa com canudo retrátil e alça de transporte.',
   'https://shop.tiktok.com/view/product/1729384764',
   'BR', 99.90, 17, 165000, 121, 58, 'ativo',
   'Teste de gelo após 24 horas. Produto de ticket médio com ótima conversão em público fitness.',
   4),

  ('Suporte Articulado para Celular e Tablet',
   'https://picsum.photos/seed/suporte-celular/600/600',
   'Acessórios',
   'Braço flexível de 80cm com base reforçada e rotação 360°. Compatível com aparelhos de 4 a 13 polegadas.',
   'https://shop.tiktok.com/view/product/1729384765',
   'BR', 59.90, 21, 120000, 94, 42, 'ativo',
   'Cenário real: receita na cozinha ou série na cama. Público amplo, bom para testar criadores novos.',
   5),

  ('Máscara de Hidratação Capilar Reconstrução 500g',
   'https://picsum.photos/seed/mascara-capilar/600/600',
   'Beleza e Cuidados',
   'Máscara com queratina hidrolisada, óleo de argan e D-pantenol. Reconstrução profunda para cabelos com química em 5 minutos.',
   'https://shop.tiktok.com/view/product/1729384766',
   'BR', 54.90, 24, 205000, 163, 71, 'em_alta',
   'Antes e depois do frizz com cabelo molhado. Recorrência alta: ótimo para lives semanais.',
   1),

  ('Relógio Smartwatch Fitness AMOLED',
   'https://picsum.photos/seed/smartwatch/600/600',
   'Eletrônicos',
   'Tela AMOLED 1.85", chamada via Bluetooth, monitor de sono e SpO2, 100+ modos esportivos e 7 dias de bateria.',
   'https://shop.tiktok.com/view/product/1729384767',
   'MX', 599.00, 12, 390000, 301, 132, 'ativo',
   'Comparativo funcional com modelos 5x mais caros. Mostre a notificação de chamada no pulso.',
   2),

  ('Tapete de Yoga Antiderrapante 6mm',
   'https://picsum.photos/seed/tapete-yoga/600/600',
   'Fitness',
   'Tapete em TPE ecológico com 6mm de espessura, dupla face texturizada e alça de transporte. Mede 183x61cm.',
   'https://shop.tiktok.com/view/product/1729384768',
   'BR', 89.00, 18, 98000, 76, 34, 'novo',
   'Rotina de alongamento matinal de 30 segundos. Categoria em crescimento, boa para criadores de bem-estar.',
   0),

  ('Aspirador de Pó Portátil Sem Fio',
   'https://picsum.photos/seed/aspirador/600/600',
   'Casa e Cozinha',
   'Aspirador com sucção de 9000Pa, filtro HEPA lavável, bocal para estofados e bateria de 2200mAh. Pesa 780g.',
   'https://shop.tiktok.com/view/product/1729384769',
   'BR', 159.90, 15, 260000, 187, 82, 'ativo',
   'Limpeza de banco de carro e sofá com o reservatório visível no final. Imagem de sujeira coletada converte muito.',
   3),

  ('Conjunto Moletom Oversized Unissex',
   'https://picsum.photos/seed/moletom/600/600',
   'Moda Feminina',
   'Conjunto com blusa e calça em moletom peluciado, modelagem oversized e punhos canelados. Disponível do P ao GG.',
   'https://shop.tiktok.com/view/product/1729384770',
   'BR', 139.90, 20, 145000, 108, 47, 'pausado',
   'Provador com 3 combinações diferentes. Aguardando reposição de estoque do fornecedor.',
   6),

  ('Câmera de Segurança Wi-Fi 360°',
   'https://picsum.photos/seed/camera-wifi/600/600',
   'Eletrônicos',
   'Câmera 2K com rotação 360°, visão noturna colorida, áudio bidirecional e detecção de movimento com alerta no app.',
   'https://shop.tiktok.com/view/product/1729384771',
   'US', 39.99, 16, 310000, 233, 104, 'ativo',
   'Instalação em menos de 2 minutos e teste de visão noturna real. Produto de segurança tem alta taxa de conversão.',
   4),

  ('Brinquedo Interativo para Gatos com Pena',
   'https://picsum.photos/seed/brinquedo-gato/600/600',
   'Pet',
   'Brinquedo automático com rotação aleatória, pena substituível e desligamento inteligente após 10 minutos. Silencioso.',
   'https://shop.tiktok.com/view/product/1729384772',
   'BR', 74.90, 22, 88000, 69, 31, 'novo',
   'Reação do gato em tempo real. Conteúdo pet tem alcance orgânico alto e baixo custo de produção.',
   1),

  ('Kit 6 Potes Herméticos para Mantimentos',
   'https://picsum.photos/seed/potes-hermeticos/600/600',
   'Casa e Cozinha',
   'Potes em acrílico com trava de 4 lados e vedação em silicone. Capacidades de 500ml a 2L, livres de BPA.',
   'https://shop.tiktok.com/view/product/1729384773',
   'BR', 134.90, 17, 112000, 88, 39, 'ativo',
   'Organização de despensa com etiquetas. Antes e depois do armário é o formato vencedor.',
   5),

  ('Perfume Masculino Amadeirado 100ml',
   'https://picsum.photos/seed/perfume-masc/600/600',
   'Beleza e Cuidados',
   'Fragrância amadeirada com notas de cedro, bergamota e âmbar. Fixação média de 8 horas, frasco de vidro.',
   'https://shop.tiktok.com/view/product/1729384774',
   'BR', 119.90, 23, 175000, 141, 63, 'ativo',
   'Reações de pessoas cheirando na rua. Formato de pegadinha/social proof funciona muito bem com perfume.',
   2),

  ('Suporte Veicular Magnético com Carregador',
   'https://picsum.photos/seed/suporte-veicular/600/600',
   'Automotivo',
   'Carregador por indução 15W com sensor infravermelho, ventosa de gel e braço ajustável. Compatível com MagSafe.',
   'https://shop.tiktok.com/view/product/1729384775',
   'BR', 109.90, 16, 0, 0, 0, 'esgotado',
   'Sem criadores ativos no momento. Retomar a divulgação após normalizar o estoque.',
   7)
) as v(
  nome, imagem, categoria, descricao, link_tiktok, pais,
  preco, comissao, gvm_max, videos_criadores, quantidade_criadores,
  status, estrategia, dias_atras
)
where not exists (
  select 1 from public.products p where p.nome = v.nome
);

-- confira o resultado
select status, count(*) as produtos, round(avg(max_score), 2) as score_medio
from public.products
group by status
order by produtos desc;
