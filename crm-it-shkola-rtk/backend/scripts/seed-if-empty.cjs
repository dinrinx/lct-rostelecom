// Первичный seed "по требованию": сеет демо-данные только если в БД ещё нет
// ни одного вуза — так рестарт контейнера на уже работающем стенде (защита,
// демо для жюри) не затирает то, что накопилось за время показа. Настоящую
// пересадку данных ("посеять заново") включает SEED_ON_START=always
// (см. scripts/docker-entrypoint.sh), обычный CommonJS без ts-node — сам
// npm run seed (вызывается из entrypoint) уже TypeScript и идёт через ts-node.
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

async function main() {
  const prisma = new PrismaClient();
  try {
    const universityCount = await prisma.university.count();
    if (universityCount > 0) {
      console.log(`[seed-if-empty] в БД уже есть ${universityCount} вуз(ов) — seed пропущен.`);
      return;
    }
    console.log('[seed-if-empty] БД пустая — выполняю npm run seed...');
    execSync('npm run seed', { stdio: 'inherit' });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[seed-if-empty] ошибка:', error);
  process.exit(1);
});
