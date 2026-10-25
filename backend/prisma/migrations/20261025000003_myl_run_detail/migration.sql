-- La corrida de Mitos y Leyendas del 25-oct-2026 (2:09 a. m., hora de Chile) corrió antes de que las corridas guardaran la lista de lo que entra,
-- y el panel solo tenía sus cifras. Se reconstruye esa lista con las 285 cartas que entraron (los ids vienen de la simulación previa; el nombre, la edición,
-- el producto y la imagen se leen de la base). Solo toca esa corrida, y solo si todavía no tiene listas: en otras bases no hace nada.
UPDATE "CatalogSyncRun" AS r
SET "summary" = COALESCE(r."summary", '{}'::jsonb) || jsonb_build_object('lists', jsonb_build_object(
  'cards', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p."productId", 'name', p."name", 'block', b."name", 'edition', g."name", 'product', pp."name", 'imageUrl', NULLIF(p."imageUrl", ''))
                              ORDER BY b."name", g."name", p."name"), '[]'::jsonb)
    FROM "TcgProduct" p
    JOIN "TcgGroup" g ON g."groupId" = p."groupId"
    LEFT JOIN "TcgBlock" b ON b."id" = g."blockId"
    LEFT JOIN "TcgPhysicalProduct" pp ON pp."id" = p."physicalProductId"
    WHERE p."productId" IN ('52506', '52507', '52950', '52951', '52952', '52953', '52954', '52955', '52956', '52957', '52958', '52959', '52960', '52961', '52962', '52963', '52964', '52965', '52966', '52967', '52968', '52969', '52970', '52971', '52972', '52973', '52974', '52975', '52976', '52977', '52978', '52979', '52980', '52981', '52982', '52983', '52984', '52985', '52986', '52987', '52988', '52989', '52990', '52991', '52992', '52993', '52994', '52995', '52996', '52997', '52998', '52999', '53000', '53001', '53002', '53003', '53004', '53005', '53006', '53007', '53008', '53009', '53010', '53011', '53012', '53013', '53014', '53015', '53016', '53017', '53018', '53019', '53020', '53021', '53022', '53023', '53024', '53025', '53026', '53027', '53028', '53029', '53030', '53031', '53032', '53033', '53034', '53035', '53036', '53037', '53038', '53039', '53040', '53041', '53042', '53043', '53044', '53045', '53046', '53047', '53048', '53049', '53050', '53051', '53052', '53053', '53054', '53055', '53056', '53057', '53058', '53059', '53060', '53061', '53062', '53063', '53064', '53065', '53066', '53067', '53068', '53069', '53070', '53071', '53072', '53073', '53074', '53075', '53076', '53077', '53078', '53079', '53080', '53081', '53082', '53083', '53084', '53085', '53086', '53087', '53088', '53089', '53090', '53091', '53092', '53093', '53094', '53095', '53096', '53097', '53098', '53099', '53100', '53101', '53102', '53103', '53104', '53105', '53106', '53107', '53108', '53109', '53110', '53111', '53112', '53113', '53114', '53115', '53116', '53117', '53118', '53119', '53120', '53121', '53122', '53123', '53124', '53125', '53126', '53127', '53128', '53129', '53130', '53131', '53132', '53133', '53134', '53135', '53136', '53137', '53138', '53139', '53140', '53141', '53142', '53143', '53144', '53145', '53146', '53147', '53148', '53149', '53150', '53151', '53152', '53153', '53154', '53155', '53156', '53157', '53158', '53159', '53160', '53161', '53162', '53163', '53164', '53165', '53166', '53167', '53168', '53169', '53170', '53171', '53172', '53173', '53174', '53175', '53176', '53177', '53178', '53179', '53180', '53181', '53182', '53183', '53184', '53185', '53186', '53187', '53188', '53189', '53190', '53191', '53192', '53193', '53194', '53195', '53196', '53197', '53198', '53199', '53200', '53201', '53202', '53203', '53204', '53205', '53206', '53207', '53208', '53209', '53210', '53211', '53212', '53213', '53214', '53215', '53216', '53217', '53218', '53219', '53234', '53235', '53236', '53237', '53274', '53275', '53276', '53306', '53307', '53308', '53309', '53310', '53311')
  ),
  'editions', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', g."name", 'block', b."name") ORDER BY g."name"), '[]'::jsonb)
    FROM "TcgGroup" g
    LEFT JOIN "TcgBlock" b ON b."id" = g."blockId"
    WHERE g."categoryId" = 99 AND g."groupId" >= 900000 AND g."name" IN ('Drácula: Carmilla la Condesa', 'Drácula: Cazadores Nocturnos', 'Drácula: Hijos de la Noche', 'Drácula: Rey Vampiro', 'Drácula: Rey Vampiro - Inmortales', 'Drácula: Ruthven el Vampiro', 'Promociones CasaMyL 2026')
  ),
  'products', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', pp."name", 'block', b."name") ORDER BY pp."name"), '[]'::jsonb)
    FROM "TcgPhysicalProduct" pp
    LEFT JOIN "TcgBlock" b ON b."id" = pp."blockId"
    WHERE pp."categoryId" = 99 AND (pp."name", b."name") IN (('EDICION LIMITADA JO', 'Primer Bloque'), ('DRAC', 'Imperio'), ('INMDRAC', 'Imperio'), ('173', 'Imperio'))
  ),
  'filled', '[]'::jsonb
))
WHERE r."source" = 'myl'
  AND r."startedAt" >= TIMESTAMP '2026-10-25 05:08:00' AND r."startedAt" < TIMESTAMP '2026-10-25 05:11:00'
  AND (r."summary" -> 'lists') IS NULL;
