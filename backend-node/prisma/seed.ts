import {
    PrismaClient,
    program_goal,
    competitive_level,
    users,
} from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function seedSports() {
    console.log("Seeding sports...");
    const sports = [
        {
            name: "Boxing",
            description: "The Sweet Science — Olympic and professional boxing.",
            icon: "🥊",
        },
        {
            name: "MMA",
            description: "Mixed Martial Arts, combining various combat disciplines.",
            icon: "🥋",
        },
        {
            name: "Football",
            description: "American Football.",
            icon: "🏈",
        },
        {
            name: "Basketball",
            description: "Hoops.",
            icon: "🏀",
        },
        {
            name: "Swimming",
            description: "Aquatic sport.",
            icon: "🏊",
        },
        {
            name: "Tennis",
            description: "Racket sport.",
            icon: "🎾",
        },
        {
            name: "Track & Field",
            description: "Athletics competitions.",
            icon: "🏃",
        },
        {
            name: "General Fitness",
            description: "Overall health and fitness training.",
            icon: "💪",
        },
    ];

    for (const sport of sports) {
        await prisma.sports.upsert({
            where: { name: sport.name },
            update: {},
            create: sport,
        });
    }
    console.log("Sports seeded successfully.");
}

async function seedCoach(): Promise<users> {
    console.log("Seeding a default coach...");
    const coachEmail = "coach.seed@ringsidetest.com";
    let coach = await prisma.users.findUnique({ where: { email: coachEmail } });

    if (!coach) {
        const hashedPassword = await bcrypt.hash("Password123!", 10);
        coach = await prisma.users.create({
            data: {
                username: "CoachRingside",
                email: coachEmail,
                password_hash: hashedPassword,
                role: "coach",
                date_of_birth: new Date("1985-01-01"),
                bio: "A seasoned coach dedicated to helping athletes reach their peak performance. I build champions.",
                //refreshToken: `seed-token-coach-${Date.now()}`, // Satisfy NOT NULL UNIQUE constraint
                is_active: true,
            },
        });
        console.log(`Created coach: ${coach.username}`);
    } else {
        console.log(`Coach already exists: ${coach.username}`);
    }
    return coach;
}

async function seedPrograms(coachId: string) {
    console.log("Seeding programs...");
    const boxing = await prisma.sports.findUnique({ where: { name: "Boxing" } });
    const generalFitness = await prisma.sports.findUnique({
        where: { name: "General Fitness" },
    });

    if (!boxing || !generalFitness) {
        console.error(
            "Sports 'Boxing' or 'General Fitness' not found. Make sure to seed sports first.",
        );
        return;
    }

    const programs = [
        {
            title: "Beginner's Boxing Fundamentals",
            description:
                "A 4-week program to learn the basics of boxing, from stance and footwork to basic punches and defensive moves. Perfect for those new to the sweet science.",
            sport_id: boxing.id,
            goal_primary: "general" as program_goal,
            level_target: "novice" as competitive_level,
            duration_weeks: 4,
            sessions_per_week: 3,
            is_published: true,
            cover_image:
                "https://images.unsplash.com/photo-1593501938052-25d115578dec?q=80&w=2070&auto=format&fit=crop",
            program_blocks: {
                create: [
                    {
                        name: "Phase 1: Foundation",
                        description:
                            "Weeks 1-2: Building a solid base with stance, footwork, and primary punches.",
                        order_index: 0,
                        week_start: 1,
                        week_end: 2,
                        program_sessions: {
                            create: [
                                {
                                    name: "Day 1: Stance & Footwork",
                                    description: "Mastering the boxer's stance and basic movements.",
                                    day_offset: 0,
                                    estimated_duration_minutes: 45,
                                    session_exercises: {
                                        create: [
                                            {
                                                exercise_name: "Jump Rope",
                                                sets: 3,
                                                reps: "3 minutes",
                                                rest_seconds: 60,
                                                order_index: 0,
                                                notes: "Focus on light feet and consistent rhythm.",
                                            },
                                            {
                                                exercise_name: "Shadow Boxing (Stance & Movement)",
                                                sets: 4,
                                                reps: "3 minutes",
                                                rest_seconds: 60,
                                                order_index: 1,
                                                notes:
                                                    "Practice moving forward, backward, and laterally in your stance.",
                                            },
                                            {
                                                exercise_name: "Plank",
                                                sets: 3,
                                                reps: "60 seconds",
                                                rest_seconds: 60,
                                                order_index: 2,
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        },
    ];

    for (const programData of programs) {
        const existing = await prisma.programs.findFirst({
            where: { title: programData.title, coach_id: coachId },
        });
        if (!existing) {
            await prisma.programs.create({
                data: {
                    ...programData,
                    coach_id: coachId,
                },
            });
            console.log(`Created program: "${programData.title}"`);
        } else {
            console.log(`Program already exists: "${programData.title}"`);
        }
    }
    console.log("Programs seeded successfully.");
}

async function main() {
    console.log(`Start seeding ...`);
    await seedSports();
    const coach = await seedCoach();
    await seedPrograms(coach.id);
    console.log(`Seeding finished.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });