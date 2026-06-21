import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // 1. إضافة رياضة الملاكمة
    const boxing = await prisma.sports.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            name: 'Boxing',
            description: 'The Sweet Science — Olympic and professional boxing',
            is_active: true,
        },
    });
    console.log(`✅ Sport: ${boxing.name} added.`);

    // 2. إضافة الفئات العمرية (بالحقول الناقصة)
    const ageGroups = [
        { id: 1, name: 'Under-18', min_age: 10, max_age: 17 },
        { id: 2, name: '18-35', min_age: 18, max_age: 35 },
        { id: 3, name: 'Over-35', min_age: 36, max_age: 100 },
    ];

    for (const group of ageGroups) {
        await prisma.age_groups.upsert({
            where: { id: group.id },
            update: {},
            create: group,
        });
    }
    console.log(`✅ Age Groups added.`);

    // 3. إضافة الخصائص الرياضية (مربوطة بالرياضة رقم 1 وبالترتيب)
    const attributesData = [
        { name: 'Strength', description: 'Maximal force generation', display_order: 1 },
        { name: 'Explosiveness', description: 'Power and speed', display_order: 2 },
        { name: 'Anaerobic Capacity', description: 'High-intensity endurance', display_order: 3 },
        { name: 'Aerobic Endurance', description: 'Cardiovascular stamina', display_order: 4 },
        { name: 'Speed', description: 'Velocity of movement', display_order: 5 }
    ];

    for (const attr of attributesData) {
        const existing = await prisma.sport_attributes.findFirst({ where: { name: attr.name, sport_id: boxing.id } });
        if (!existing) {
            await prisma.sport_attributes.create({ data: { ...attr, sport_id: boxing.id } });
        }
    }
    console.log(`✅ Sport Attributes added.`);

    // 4. إضافة الاختبارات البدنية
    const tests = [
        { attributeName: 'Strength', test_name: 'Trap Bar Deadlift', higher_is_better: true, weight: 1.0, unit: 'kg' },
        { attributeName: 'Explosiveness', test_name: 'Power Clean', higher_is_better: true, weight: 0.5, unit: 'kg' },
        { attributeName: 'Explosiveness', test_name: 'Box Jump Height', higher_is_better: true, weight: 0.5, unit: 'cm' },
        { attributeName: 'Anaerobic Capacity', test_name: 'Medicine Ball Rotational Throw', higher_is_better: true, weight: 1.0, unit: 'meters' },
        { attributeName: 'Aerobic Endurance', test_name: '1.5 Mile Run', higher_is_better: false, weight: 1.0, unit: 'minutes' },
        { attributeName: 'Speed', test_name: '10m Sprint', higher_is_better: false, weight: 1.0, unit: 'seconds' }
    ];

    for (const test of tests) {
        const { attributeName, ...testData } = test;
        const attribute = await prisma.sport_attributes.findFirst({ where: { name: attributeName, sport_id: boxing.id } });
        if (attribute) {
            const existing = await prisma.attribute_tests.findFirst({ where: { test_name: testData.test_name } });
            if (!existing) {
                await prisma.attribute_tests.create({ data: { ...testData, sport_attribute_id: attribute.id } });
            }
        }
    }
    console.log(`✅ Attribute Tests added.`);

    console.log('🎉 Seeding finished successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:');
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });