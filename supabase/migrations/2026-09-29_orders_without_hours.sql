-- Заповед за заместване, издадена БЕЗ часове (разписанието на отсъстващия още не е пълно, < 21 ч.)
-- В регистъра се оцветява, за да се генерира отново с таблицата, когато разписанието е готово.
alter table orders add column if not exists without_hours boolean not null default false;
