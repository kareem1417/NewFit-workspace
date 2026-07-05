import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Seeding extra tests...');
    let sport = await prisma.sports.findFirst({ where: { name: 'Boxing' } });
    if (!sport) {
        sport = await prisma.sports.create({ data: { name: 'Boxing', description: 'Standard Boxing Profile' } });
        console.log('🥊 Created Boxing sport!');
    }

    let ageGroup = await prisma.age_groups.findFirst({ where: { name: 'Adult' } });
    if (!ageGroup) {
        ageGroup = await prisma.age_groups.create({ data: { name: 'Adult', min_age: 18, max_age: 35 } });
        console.log('👥 Created Adult age group!');
    }

    const attributes = [
        { name: 'Strength', description: 'Maximum force generation' },
        { name: 'Explosive', description: 'Rate of force development' },
        { name: 'Core', description: 'Core stability and rotational power' },
        { name: 'Aerobic', description: 'Cardiovascular endurance' },
        { name: 'Muscular', description: 'Muscular endurance' },
    ];

    // Ensure attributes exist
    for (const attr of attributes) {
        const existing = await prisma.sport_attributes.findFirst({ where: { name: attr.name } });
        if (!existing) {
            // Ensure attributes exist
            for (const attr of attributes) {
                const existing = await prisma.sport_attributes.findFirst({ where: { name: attr.name } });
                if (!existing) {
                    await prisma.sport_attributes.create({ data: attr as any });
                }
            }
        }
    }

    const testDefinitions = [
        { name: 'Deadlift', attribute: 'Strength', unit: 'kg', higherIsBetter: true, mean: 140, stdDev: 20 },
        { name: 'Power Clean', attribute: 'Explosive', unit: 'kg', higherIsBetter: true, mean: 90, stdDev: 15 },
        { name: 'Medicine Ball Throw', attribute: 'Core', unit: 'm', higherIsBetter: true, mean: 12, stdDev: 2 },
        { name: '1.5 Mile Run', attribute: 'Aerobic', unit: 'sec', higherIsBetter: false, mean: 600, stdDev: 45 },
        { name: 'Burpee Test', attribute: 'Muscular', unit: 'reps', higherIsBetter: true, mean: 40, stdDev: 10 }
    ];

    console.log('--- Generated IDs for Flutter Integration ---');
    for (const t of testDefinitions) {
        const attr = await prisma.sport_attributes.findFirst({ where: { name: t.attribute } });
        if (!attr) continue;

        let test = await prisma.attribute_tests.findFirst({ where: { test_name: t.name } });
        if (!test) {
            test = await prisma.attribute_tests.create({
                data: { sport_attribute_id: attr.id, test_name: t.name, weight: 0.2, unit: t.unit, higher_is_better: t.higherIsBetter }
            });
        }

        console.log(`Test: ${t.name} -> ID: ${test.id}`);

        // Add norms for amateur middleweight
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