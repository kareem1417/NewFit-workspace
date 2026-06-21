import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Seeding extra tests...');
    const sport = await prisma.sports.findFirst({ where: { name: 'Boxing' } });
    const attribute = await prisma.sport_attributes.findFirst({ where: { name: 'Strength' } });
    const ageGroup = await prisma.age_groups.findUnique({ where: { id: 2 } });

    if (!sport || !attribute || !ageGroup) {
        console.error('Run the first seed script first!');
        return;
    }

    // التمارين اللي باقية (شيلنا منها الـ id الثابت)
    const newTests = [
        { name: 'Power Clean', unit: 'kg', higherIsBetter: true, mean: 90, stdDev: 15 },
        { name: 'Medicine Ball Rotational Throw', unit: 'm', higherIsBetter: true, mean: 12, stdDev: 2 },
        { name: '1.5 Mile Run', unit: 'sec', higherIsBetter: false, mean: 600, stdDev: 45 },
        { name: '10m Sprint', unit: 'sec', higherIsBetter: false, mean: 1.8, stdDev: 0.2 }
    ];

    for (const t of newTests) {
        // 1. إضافة التمرين
        let test = await prisma.attribute_tests.findFirst({ where: { test_name: t.name } });
        if (!test) {
            test = await prisma.attribute_tests.create({
                // الداتا بيز هتولد الـ id لوحدها هنا
                data: { sport_attribute_id: attribute.id, test_name: t.name, weight: 0.2, unit: t.unit, higher_is_better: t.higherIsBetter }
            });
        }

        // 2. إضافة الأرقام القياسية ليه (Amateur Middleweight)
        const existingNorm = await prisma.normative_data.findFirst({
            where: { sport_id: sport.id, attribute_test_id: test.id, weight_class: 'middleweight', level: 'amateur', age_group_id: ageGroup.id }
        });

        if (!existingNorm) {
            await prisma.normative_data.create({
                data: {
                    sport_id: sport.id, attribute_test_id: test.id, weight_class: 'middleweight', level: 'amateur', age_group_id: ageGroup.id,
                    mean_value: t.mean, std_dev: t.stdDev
                }
            });
        }
    }

    console.log('🎉 Extra tests seeded successfully!');
}

main().finally(async () => { await prisma.$disconnect(); });