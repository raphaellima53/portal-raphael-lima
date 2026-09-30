-- 30/09/2026: cor e CEFR de cada nível, como o usuário definiu (não alterar). A leitura usa o que está gravado no
-- módulo; esta migração só acerta os valores oficiais uma vez.
UPDATE "Modulo" AS m SET cor = v.cor, cefr = v.cefr
FROM (VALUES
  ('Confidence', '#2377FF', 'A0'),
  ('Essential 1', '#0E56D5', 'A1'),
  ('Essential 2', '#003FB0', 'A1+'),
  ('Essential 3', '#083688', 'A2'),
  ('Essential 4', '#062967', 'A2+'),
  ('Rise 1', '#A14F9C', 'B1'),
  ('Rise 2', '#83367E', 'B1+'),
  ('Rise 3', '#6E0C6F', 'B2'),
  ('Apex 1', '#D13543', 'B2+'),
  ('Apex 2', '#B41624', 'C1'),
  ('Apex 3', '#8E0F1A', 'C1+')
) AS v(nome, cor, cefr)
WHERE m.nome = v.nome;
