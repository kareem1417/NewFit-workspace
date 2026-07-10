// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');
  console.log('🧹 Cleaning up existing data...');

  // ==========================================
  // CLEANUP — delete children before parents
  // ==========================================

  // Completed workout tracking
  await prisma.completed_exercises.deleteMany();
  await prisma.completed_sessions.deleteMany();

  // Ratings/enrollments/snapshots
  await prisma.program_ratings.deleteMany();
  await prisma.snapshot_test_values.deleteMany();

  // Break circular FK:
  // physical_snapshots.program_enrollment_id -> enrollments.id
  // enrollments.baseline_snapshot_id -> physical_snapshots.id
  await prisma.physical_snapshots.updateMany({
    data: {
      program_enrollment_id: null,
    },
  });

  await prisma.enrollments.deleteMany();
  await prisma.physical_snapshots.deleteMany();

  // Social data
  await prisma.likes.deleteMany();
  await prisma.comments.deleteMany();
  await prisma.posts.deleteMany();
  await prisma.follows.deleteMany();

  // Chat data
  await prisma.chat_messages.deleteMany();
  await prisma.chat_sessions.deleteMany();

  // Program structure
  await prisma.session_exercises.deleteMany();
  await prisma.program_sessions.deleteMany();
  await prisma.program_blocks.deleteMany();
  await prisma.programs.deleteMany();

  // User-related data
  await prisma.user_tokens.deleteMany();
  await prisma.user_metrics.deleteMany();
  await prisma.user_sport_profiles.deleteMany();
  await prisma.coach_profiles.deleteMany();

  // Users
  await prisma.users.deleteMany();

  // Sports/tests/normative data
  await prisma.normative_data.deleteMany();
  await prisma.attribute_tests.deleteMany();
  await prisma.sport_attributes.deleteMany();
  await prisma.age_groups.deleteMany();
  await prisma.sports.deleteMany();

  // Optional independent AI knowledge table
  await prisma.knowledge_chunks.deleteMany();

  console.log('✅ Existing data cleaned');

  // ==========================================
  // 1. SPORTS

  // ==========================================
  // 1. SPORTS
  // ==========================================
  const sports = await Promise.all([
    prisma.sports.create({
      data: {
        name: 'Boxing',
        description: 'Combat sport focusing on punches, footwork, and defensive techniques',
        icon: '🥊',
      },
    }),
    prisma.sports.create({
      data: {
        name: 'Football',
        description: 'Team sport requiring endurance, speed, and tactical awareness',
        icon: '⚽',
      },
    }),
    prisma.sports.create({
      data: {
        name: 'Basketball',
        description: 'Fast-paced court sport emphasizing vertical leap, agility, and coordination',
        icon: '🏀',
      },
    }),
    prisma.sports.create({
      data: {
        name: 'Swimming',
        description: 'Water-based sport developing full-body endurance and technique',
        icon: '🏊',
      },
    }),
    prisma.sports.create({
      data: {
        name: 'Tennis',
        description: 'Racket sport requiring explosive lateral movement and precision',
        icon: '🎾',
      },
    }),
  ]);

  console.log(`✅ Created ${sports.length} sports`);

  // ==========================================
  // 2. SPORT ATTRIBUTES (4 per sport)
  // ==========================================

  const attributesData = [
    // BOXING (sport_id: 1)
    { sport_id: sports[0].id, name: 'Punch Power', display_order: 1, description: 'Raw punching force and knockout potential' },
    { sport_id: sports[0].id, name: 'Hand Speed', display_order: 2, description: 'Speed of punch delivery and combinations' },
    { sport_id: sports[0].id, name: 'Footwork & Agility', display_order: 3, description: 'Movement efficiency and ring control' },
    { sport_id: sports[0].id, name: 'Defense & Reflexes', display_order: 4, description: 'Head movement, blocking, and counter-punching' },

    // FOOTBALL (sport_id: 2)
    { sport_id: sports[1].id, name: 'Sprint Speed', display_order: 1, description: 'Maximum running velocity and acceleration' },
    { sport_id: sports[1].id, name: 'Endurance', display_order: 2, description: 'Aerobic capacity and match fitness' },
    { sport_id: sports[1].id, name: 'Ball Control', display_order: 3, description: 'Dribbling, first touch, and close control' },
    { sport_id: sports[1].id, name: 'Shooting Power', display_order: 4, description: 'Shot velocity and long-range accuracy' },

    // BASKETBALL (sport_id: 3)
    { sport_id: sports[2].id, name: 'Vertical Jump', display_order: 1, description: 'Explosive leaping ability for rebounds and dunks' },
    { sport_id: sports[2].id, name: 'Agility', display_order: 2, description: 'Change of direction and court mobility' },
    { sport_id: sports[2].id, name: 'Shooting Accuracy', display_order: 3, description: 'Field goal and free throw precision' },
    { sport_id: sports[2].id, name: 'Upper Body Strength', display_order: 4, description: 'Post play, screens, and defensive presence' },

    // SWIMMING (sport_id: 4)
    { sport_id: sports[3].id, name: 'Pull Strength', display_order: 1, description: 'Upper body pulling power in water' },
    { sport_id: sports[3].id, name: 'Kick Power', display_order: 2, description: 'Lower body propulsion efficiency' },
    { sport_id: sports[3].id, name: 'Core Stability', display_order: 3, description: 'Body rotation and streamline maintenance' },
    { sport_id: sports[3].id, name: 'Cardiovascular Endurance', display_order: 4, description: 'Sustained aerobic output during long distances' },

    // TENNIS (sport_id: 5)
    { sport_id: sports[4].id, name: 'Serve Velocity', display_order: 1, description: 'Maximum serve speed and power' },
    { sport_id: sports[4].id, name: 'Lateral Quickness', display_order: 2, description: 'Side-to-side court coverage' },
    { sport_id: sports[4].id, name: 'Rotational Power', display_order: 3, description: 'Groundstroke and serve rotation force' },
    { sport_id: sports[4].id, name: 'Grip Endurance', display_order: 4, description: 'Forearm strength and racket control' },
  ];

  const attributes = await Promise.all(
    attributesData.map(attr => prisma.sport_attributes.create({ data: attr }))
  );

  console.log(`✅ Created ${attributes.length} sport attributes (4 per sport)`);

  // ==========================================
  // 3. ATTRIBUTE TESTS (2-3 tests per attribute)
  // ==========================================

  const testsData = [
    // --- BOXING TESTS ---
    // Punch Power
    { sport_attribute_id: attributes[0].id, test_name: 'Medicine Ball Rotational Throw', weight: 0.4, unit: 'meters', higher_is_better: true, description: 'Measures rotational power transfer to punches' },
    { sport_attribute_id: attributes[0].id, test_name: 'Punch Force Dynamometer', weight: 0.6, unit: 'kg', higher_is_better: true, description: 'Direct punch force measurement' },

    // Hand Speed
    { sport_attribute_id: attributes[1].id, test_name: 'Accelerometer Punch Speed', weight: 0.5, unit: 'm/s', higher_is_better: true, description: 'Maximum hand velocity during punch' },
    { sport_attribute_id: attributes[1].id, test_name: '30-Second Punch Count', weight: 0.5, unit: 'reps', higher_is_better: true, description: 'Number of punches in 30 seconds' },

    // Footwork & Agility
    { sport_attribute_id: attributes[2].id, test_name: 'T-Test Agility', weight: 0.5, unit: 'seconds', higher_is_better: false, description: 'Multi-directional movement speed' },
    { sport_attribute_id: attributes[2].id, test_name: 'Ladder Drill Time', weight: 0.5, unit: 'seconds', higher_is_better: false, description: 'Foot speed through agility ladder' },

    // Defense & Reflexes
    { sport_attribute_id: attributes[3].id, test_name: 'Reaction Time Test', weight: 0.6, unit: 'ms', higher_is_better: false, description: 'Visual stimulus response time' },
    { sport_attribute_id: attributes[3].id, test_name: 'Slip Line Efficiency', weight: 0.4, unit: 'percentage', higher_is_better: true, description: 'Success rate in defensive drills' },

    // --- FOOTBALL TESTS ---
    // Sprint Speed
    { sport_attribute_id: attributes[4].id, test_name: '40-Yard Dash', weight: 0.5, unit: 'seconds', higher_is_better: false, description: 'Maximum sprint speed over 40 yards' },
    { sport_attribute_id: attributes[4].id, test_name: '10-Meter Acceleration', weight: 0.5, unit: 'seconds', higher_is_better: false, description: 'Initial burst speed' },

    // Endurance
    { sport_attribute_id: attributes[5].id, test_name: 'Yo-Yo Intermittent Recovery Test', weight: 0.6, unit: 'meters', higher_is_better: true, description: 'Football-specific endurance test' },
    { sport_attribute_id: attributes[5].id, test_name: 'Cooper Test', weight: 0.4, unit: 'meters', higher_is_better: true, description: '12-minute run distance' },

    // Ball Control
    { sport_attribute_id: attributes[6].id, test_name: 'Dribbling Slalom Time', weight: 0.5, unit: 'seconds', higher_is_better: false, description: 'Ball control through cones' },
    { sport_attribute_id: attributes[6].id, test_name: 'Juggling Count', weight: 0.5, unit: 'reps', higher_is_better: true, description: 'Consecutive ball touches' },

    // Shooting Power
    { sport_attribute_id: attributes[7].id, test_name: 'Shot Speed Radar', weight: 0.7, unit: 'km/h', higher_is_better: true, description: 'Maximum shot velocity' },
    { sport_attribute_id: attributes[7].id, test_name: 'Long Pass Accuracy', weight: 0.3, unit: 'percentage', higher_is_better: true, description: '40-meter pass completion rate' },

    // --- BASKETBALL TESTS ---
    // Vertical Jump
    { sport_attribute_id: attributes[8].id, test_name: 'Max Vertical Jump', weight: 0.5, unit: 'cm', higher_is_better: true, description: 'Standing vertical leap height' },
    { sport_attribute_id: attributes[8].id, test_name: 'Running Vertical Jump', weight: 0.5, unit: 'cm', higher_is_better: true, description: 'Approach jump maximum height' },

    // Agility
    { sport_attribute_id: attributes[9].id, test_name: 'Lane Agility Drill', weight: 0.6, unit: 'seconds', higher_is_better: false, description: 'NBA combine agility test' },
    { sport_attribute_id: attributes[9].id, test_name: '5-10-5 Shuttle Run', weight: 0.4, unit: 'seconds', higher_is_better: false, description: 'Pro agility test' },

    // Shooting Accuracy
    { sport_attribute_id: attributes[10].id, test_name: 'Spot-Up Shooting', weight: 0.5, unit: 'percentage', higher_is_better: true, description: 'Catch-and-shoot accuracy from 5 spots' },
    { sport_attribute_id: attributes[10].id, test_name: 'Free Throw Percentage', weight: 0.5, unit: 'percentage', higher_is_better: true, description: '50 consecutive free throws' },

    // Upper Body Strength
    { sport_attribute_id: attributes[11].id, test_name: 'Bench Press 185 lbs', weight: 0.6, unit: 'reps', higher_is_better: true, description: 'Maximum reps at 185 lbs (NBA Combine)' },
    { sport_attribute_id: attributes[11].id, test_name: 'Pull-Up Max', weight: 0.4, unit: 'reps', higher_is_better: true, description: 'Maximum consecutive pull-ups' },

    // --- SWIMMING TESTS ---
    // Pull Strength
    { sport_attribute_id: attributes[12].id, test_name: 'Pull-Up Max Reps', weight: 0.4, unit: 'reps', higher_is_better: true, description: 'Upper body pulling endurance' },
    { sport_attribute_id: attributes[12].id, test_name: 'Lat Pull Down 1RM', weight: 0.6, unit: 'kg', higher_is_better: true, description: 'Maximum lat strength' },

    // Kick Power
    { sport_attribute_id: attributes[13].id, test_name: 'Kickboard 50m Sprint', weight: 0.5, unit: 'seconds', higher_is_better: false, description: 'Lower body propulsion speed' },
    { sport_attribute_id: attributes[13].id, test_name: 'Vertical Kick Test', weight: 0.5, unit: 'cm', higher_is_better: true, description: 'Height achieved using kick only' },

    // Core Stability
    { sport_attribute_id: attributes[14].id, test_name: 'Plank Hold Time', weight: 0.5, unit: 'seconds', higher_is_better: true, description: 'Maximum plank duration' },
    { sport_attribute_id: attributes[14].id, test_name: 'Streamline Float Distance', weight: 0.5, unit: 'meters', higher_is_better: true, description: 'Distance covered in streamline position' },

    // Cardiovascular Endurance
    { sport_attribute_id: attributes[15].id, test_name: '400m Freestyle Time', weight: 0.6, unit: 'seconds', higher_is_better: false, description: 'Endurance swim test' },
    { sport_attribute_id: attributes[15].id, test_name: 'VO2max Treadmill Test', weight: 0.4, unit: 'ml/kg/min', higher_is_better: true, description: 'Maximum oxygen uptake' },

    // --- TENNIS TESTS ---
    // Serve Velocity
    { sport_attribute_id: attributes[16].id, test_name: 'Radar Gun Serve Speed', weight: 0.7, unit: 'km/h', higher_is_better: true, description: 'Maximum serve velocity' },
    { sport_attribute_id: attributes[16].id, test_name: 'Medicine Ball Overhead Throw', weight: 0.3, unit: 'meters', higher_is_better: true, description: 'Overhead power assessment' },

    // Lateral Quickness
    { sport_attribute_id: attributes[17].id, test_name: 'Side Shuffle Test', weight: 0.5, unit: 'seconds', higher_is_better: false, description: '5-meter lateral movement speed' },
    { sport_attribute_id: attributes[17].id, test_name: 'Spider Drill', weight: 0.5, unit: 'seconds', higher_is_better: false, description: 'Court coverage pattern test' },

    // Rotational Power
    { sport_attribute_id: attributes[18].id, test_name: 'Rotational Medicine Ball Throw', weight: 0.5, unit: 'meters', higher_is_better: true, description: 'Trunk rotation power' },
    { sport_attribute_id: attributes[18].id, test_name: 'Cable Woodchop 1RM', weight: 0.5, unit: 'kg', higher_is_better: true, description: 'Maximum rotational strength' },

    // Grip Endurance
    { sport_attribute_id: attributes[19].id, test_name: 'Grip Dynamometer', weight: 0.6, unit: 'kg', higher_is_better: true, description: 'Maximum grip strength' },
    { sport_attribute_id: attributes[19].id, test_name: 'Dead Hang Duration', weight: 0.4, unit: 'seconds', higher_is_better: true, description: 'Maximum hang time' },
  ];

  const tests = await Promise.all(
    testsData.map(test => prisma.attribute_tests.create({ data: test }))
  );

  console.log(`✅ Created ${tests.length} attribute tests`);

  // ==========================================
  // 4. AGE GROUPS & NORMATIVE DATA
  // ==========================================

  const ageGroups = await Promise.all([
    prisma.age_groups.create({ data: { name: 'Youth (Under 18)', min_age: 10, max_age: 17, description: 'Developing athletes' } }),
    prisma.age_groups.create({ data: { name: 'Adult (18-35)', min_age: 18, max_age: 35, description: 'Peak performance years' } }),
    prisma.age_groups.create({ data: { name: 'Masters (35+)', min_age: 36, max_age: 99, description: 'Experienced athletes' } }),
  ]);

  console.log(`✅ Created ${ageGroups.length} age groups`);

  // Create comprehensive normative data for ALL boxing tests
  // Boxing tests order: [0]=Med Ball Rot Throw, [1]=Punch Force, [2]=Accel Punch Speed, [3]=30s Punch Count,
  //                     [4]=T-Test Agility, [5]=Ladder Drill, [6]=Reaction Time, [7]=Slip Line Efficiency
  const boxingTestNorms = [
    // Test 0: Medicine Ball Rotational Throw (meters, higher is better)
    { testIdx: 0, mean: 7.5, stdDev: 1.2 },
    // Test 1: Punch Force Dynamometer (kg, higher is better)
    { testIdx: 1, mean: 450.0, stdDev: 75.0 },
    // Test 2: Accelerometer Punch Speed (m/s, higher is better)
    { testIdx: 2, mean: 12.0, stdDev: 2.5 },
    // Test 3: 30-Second Punch Count (reps, higher is better)
    { testIdx: 3, mean: 85.0, stdDev: 15.0 },
    // Test 4: T-Test Agility (seconds, lower is better)
    { testIdx: 4, mean: 10.5, stdDev: 1.0 },
    // Test 5: Ladder Drill Time (seconds, lower is better)
    { testIdx: 5, mean: 9.5, stdDev: 0.8 },
    // Test 6: Reaction Time Test (ms, lower is better)
    { testIdx: 6, mean: 250.0, stdDev: 30.0 },
    // Test 7: Slip Line Efficiency (percentage, higher is better)
    { testIdx: 7, mean: 75.0, stdDev: 10.0 },
  ];

  const weightClasses = ['middleweight', 'welterweight', 'light_middleweight', 'super_middleweight', 'lightweight'] as const;
  const levels = ['amateur'] as const;

  const normativeDataEntries: any[] = [];
  for (const wc of weightClasses) {
    for (const lvl of levels) {
      for (const norm of boxingTestNorms) {
        normativeDataEntries.push({
          sport_id: sports[0].id,
          attribute_test_id: tests[norm.testIdx].id,
          player_category: wc,
          level: lvl,
          age_group_id: ageGroups[1].id,
          mean_value: norm.mean,
          std_dev: norm.stdDev,
          sample_size: 200,
          source: 'AIBA Boxing Standards 2025',
        });
      }
    }
  }

  // Also add heavyweight/professional norms
  normativeDataEntries.push({
    sport_id: sports[0].id,
    attribute_test_id: tests[1].id,
    player_category: 'heavyweight' as const,
    level: 'professional' as const,
    age_group_id: ageGroups[1].id,
    mean_value: 650.0,
    std_dev: 90.0,
    sample_size: 150,
    source: 'WBC Performance Database',
  });

  for (const entry of normativeDataEntries) {
    await prisma.normative_data.create({ data: entry });
  }

  console.log(`✅ Created ${normativeDataEntries.length} normative data entries`);

  // ==========================================
  // 5. SAMPLE PROGRAMS (1 per sport for demo)
  // ==========================================

  // Create a demo coach user
  // Create a demo coach user
  const demoCoach = await prisma.users.upsert({
    where: { email: 'coach@neofit.com' },
    update: {
      username: 'coach_mike',
      role: 'coach',
      full_name: 'Coach Mike Tyson',
      bio: 'Professional boxing coach with 20 years experience',
    },
    create: {
      username: 'coach_mike',
      email: 'coach@neofit.com',
      password_hash: '$2b$10$placeholder_hash_for_demo',
      role: 'coach',
      full_name: 'Coach Mike Tyson',
      date_of_birth: new Date('1980-06-30'),
      bio: 'Professional boxing coach with 20 years experience',
    },
  });

  // Create coach profile AFTER demoCoach exists


  // Create demo athlete user
  const demoAthlete = await prisma.users.upsert({
    where: { email: 'athlete@neofit.com' },
    update: {
      username: 'ahmed_boxer',
      role: 'athlete',
      full_name: 'Ahmed Ali',
    },
    create: {
      username: 'ahmed_boxer',
      email: 'athlete@neofit.com',
      password_hash: '$2b$10$placeholder_hash_for_demo',
      role: 'athlete',
      full_name: 'Ahmed Ali',
      date_of_birth: new Date('2000-05-15'),
    },
  });

  console.log(`✅ Created demo users and coach profile`);

  await prisma.user_sport_profiles.upsert({
    where: {
      user_id_sport_id: {
        user_id: demoAthlete.id,
        sport_id: sports[0].id,
      },
    },
    update: {
      level: 'amateur',
      player_category: 'welterweight',
      is_primary: true,
    },
    create: {
      user_id: demoAthlete.id,
      sport_id: sports[0].id,
      level: 'amateur',
      player_category: 'welterweight',
      is_primary: true,
    },
  });

  await prisma.user_metrics.upsert({
    where: { user_id: demoAthlete.id },
    update: {
      height_cm: 175,
      weight_kg: 75,
      goal: 'Power',
      training_days_per_week: 4,
      years_training: 2.5,
      has_injury_history: false,
      endurance_score: 6,
      strength_score: 7,
      speed_score: 8,
      flexibility_score: 5,
      explosiveness_score: 8,
      recovery_score: 6,
    },
    create: {
      user_id: demoAthlete.id,
      height_cm: 175,
      weight_kg: 75,
      goal: 'Power',
      training_days_per_week: 4,
      years_training: 2.5,
      has_injury_history: false,
      endurance_score: 6,
      strength_score: 7,
      speed_score: 8,
      flexibility_score: 5,
      explosiveness_score: 8,
      recovery_score: 6,
    },
  });

  console.log(`✅ Created demo athlete profile and metrics`);

  // ==========================================
  // 6. PROGRAMS WITH FULL STRUCTURE
  // ==========================================

  const programs = await Promise.all([
    // BOXING - Explosive Punch Power (8 weeks)
    prisma.programs.create({
      data: {
        coach_id: demoCoach.id,
        sport_id: sports[0].id,
        title: 'Explosive Punch Power',
        description: 'Transform your punching power in 8 weeks with science-based plyometric and strength training. Designed for amateur boxers looking to increase knockout potential.',
        goal_primary: 'explosiveness',
        level_target: 'amateur',
        duration_weeks: 8,
        sessions_per_week: 4,
        is_published: true,
        cover_image: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800',
        program_blocks: {
          create: [
            {
              name: 'Foundation Phase',
              description: 'Build strength base and technique',
              order_index: 1,
              week_start: 1,
              week_end: 3,
              program_sessions: {
                create: [
                  {
                    name: 'Strength Foundation',
                    description: 'Heavy compound lifts to build raw power',
                    day_offset: 0,
                    estimated_duration_minutes: 75,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Trap Bar Deadlift', sets: 5, reps: '5', rest_seconds: 180, intensity_note: '85% 1RM', order_index: 1 },
                        { exercise_name: 'Bench Press', sets: 4, reps: '6', rest_seconds: 120, intensity_note: '80% 1RM', order_index: 2 },
                        { exercise_name: 'Barbell Row', sets: 4, reps: '8', rest_seconds: 90, order_index: 3 },
                        { exercise_name: 'Medicine Ball Slam', sets: 3, reps: '10', rest_seconds: 60, order_index: 4 },
                      ],
                    },
                  },
                  {
                    name: 'Speed & Technique',
                    description: 'Hand speed development and punching mechanics',
                    day_offset: 2,
                    estimated_duration_minutes: 60,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Shadow Boxing (Weighted)', sets: 4, reps: '3 min', rest_seconds: 60, order_index: 1 },
                        { exercise_name: 'Speed Bag', sets: 4, reps: '3 min', rest_seconds: 45, order_index: 2 },
                        { exercise_name: 'Double-End Bag', sets: 4, reps: '2 min', rest_seconds: 45, order_index: 3 },
                        { exercise_name: 'Plyometric Push-Ups', sets: 3, reps: '8', rest_seconds: 90, order_index: 4 },
                      ],
                    },
                  },
                  {
                    name: 'Power Development',
                    description: 'Explosive movements for punch power',
                    day_offset: 4,
                    estimated_duration_minutes: 70,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Power Clean', sets: 5, reps: '3', rest_seconds: 180, intensity_note: '80% 1RM', order_index: 1 },
                        { exercise_name: 'Box Jump', sets: 4, reps: '6', rest_seconds: 120, order_index: 2 },
                        { exercise_name: 'Rotational Medicine Ball Throw', sets: 4, reps: '8 per side', rest_seconds: 90, order_index: 3 },
                        { exercise_name: 'Cable Woodchop', sets: 3, reps: '12', rest_seconds: 60, order_index: 4 },
                      ],
                    },
                  },
                  {
                    name: 'Recovery & Conditioning',
                    description: 'Active recovery and cardiovascular work',
                    day_offset: 6,
                    estimated_duration_minutes: 45,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Jump Rope', sets: 1, reps: '15 min', rest_seconds: 0, order_index: 1 },
                        { exercise_name: 'Core Circuit', sets: 3, reps: 'circuit', rest_seconds: 60, order_index: 2 },
                        { exercise_name: 'Stretching Routine', sets: 1, reps: '15 min', rest_seconds: 0, order_index: 3 },
                      ],
                    },
                  },
                ],
              },
            },
            {
              name: 'Power Phase',
              description: 'Maximize explosive output',
              order_index: 2,
              week_start: 4,
              week_end: 6,
              program_sessions: {
                create: [
                  {
                    name: 'Advanced Power',
                    description: 'Peak power development session',
                    day_offset: 0,
                    estimated_duration_minutes: 80,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Power Clean from Hang', sets: 6, reps: '2', rest_seconds: 180, intensity_note: '90% 1RM', order_index: 1 },
                        { exercise_name: 'Depth Jump to Box', sets: 4, reps: '5', rest_seconds: 150, order_index: 2 },
                        { exercise_name: 'Heavy Bag Power Rounds', sets: 6, reps: '2 min', rest_seconds: 60, intensity_note: 'Maximum power each punch', order_index: 3 },
                      ],
                    },
                  },
                  {
                    name: 'Speed-Strength Combo',
                    description: 'Combining speed and power elements',
                    day_offset: 2,
                    estimated_duration_minutes: 65,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Contrast Training: Deadlift + Box Jump', sets: 4, reps: '3+5', rest_seconds: 180, order_index: 1 },
                        { exercise_name: 'Medicine Ball Punch Throw', sets: 4, reps: '8 per arm', rest_seconds: 90, order_index: 2 },
                        { exercise_name: 'Resistance Band Punches', sets: 3, reps: '20', rest_seconds: 60, order_index: 3 },
                      ],
                    },
                  },
                  {
                    name: 'Technical Power',
                    description: 'Sport-specific power application',
                    day_offset: 4,
                    estimated_duration_minutes: 70,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Pad Work (Power Focus)', sets: 6, reps: '3 min', rest_seconds: 60, order_index: 1 },
                        { exercise_name: 'Heavy Bag Combos', sets: 4, reps: '2 min', rest_seconds: 60, order_index: 2 },
                        { exercise_name: 'Plyometric Circuit', sets: 3, reps: 'circuit', rest_seconds: 120, order_index: 3 },
                      ],
                    },
                  },
                  {
                    name: 'Active Recovery',
                    description: 'Mobility and technique maintenance',
                    day_offset: 6,
                    estimated_duration_minutes: 45,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Yoga for Fighters', sets: 1, reps: '30 min', rest_seconds: 0, order_index: 1 },
                        { exercise_name: 'Light Technical Sparring', sets: 3, reps: '3 min', rest_seconds: 60, order_index: 2 },
                      ],
                    },
                  },
                ],
              },
            },
            {
              name: 'Peak Phase',
              description: 'Final preparation and testing',
              order_index: 3,
              week_start: 7,
              week_end: 8,
              program_sessions: {
                create: [
                  {
                    name: 'Test Day Preparation',
                    description: 'Mock testing session',
                    day_offset: 0,
                    estimated_duration_minutes: 60,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Medicine Ball Rotational Throw (Test)', sets: 3, reps: '3', rest_seconds: 120, order_index: 1 },
                        { exercise_name: 'Punch Force Test', sets: 3, reps: '3', rest_seconds: 120, order_index: 2 },
                        { exercise_name: 'Light Technique Work', sets: 1, reps: '15 min', rest_seconds: 0, order_index: 3 },
                      ],
                    },
                  },
                  {
                    name: 'Final Test Day',
                    description: 'Official performance assessment',
                    day_offset: 3,
                    estimated_duration_minutes: 90,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Max Punch Force Test', sets: 1, reps: '3 attempts', rest_seconds: 180, order_index: 1 },
                        { exercise_name: 'Rotational Power Test', sets: 1, reps: '3 attempts', rest_seconds: 180, order_index: 2 },
                        { exercise_name: 'Speed Punch Test', sets: 1, reps: '30 seconds', rest_seconds: 120, order_index: 3 },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    }),

    // FOOTBALL - Speed Academy (6 weeks)
    prisma.programs.create({
      data: {
        coach_id: demoCoach.id,
        sport_id: sports[1].id,
        title: 'Speed Academy',
        description: 'Elite speed development program for football players. Improve your 40-yard dash time and on-field acceleration.',
        goal_primary: 'speed',
        level_target: 'amateur',
        duration_weeks: 6,
        sessions_per_week: 3,
        is_published: true,
        cover_image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800',
        program_blocks: {
          create: [
            {
              name: 'Acceleration Phase',
              description: 'Build explosive first-step quickness',
              order_index: 1,
              week_start: 1,
              week_end: 2,
              program_sessions: {
                create: [
                  {
                    name: 'Linear Speed Basics',
                    description: 'Fundamental sprint mechanics',
                    day_offset: 0,
                    estimated_duration_minutes: 60,
                    session_exercises: {
                      create: [
                        { exercise_name: '10-Meter Sprints', sets: 6, reps: '1', rest_seconds: 120, order_index: 1 },
                        { exercise_name: 'Resisted Sprints (Sled)', sets: 4, reps: '20m', rest_seconds: 180, order_index: 2 },
                        { exercise_name: 'Squat Jumps', sets: 3, reps: '8', rest_seconds: 90, order_index: 3 },
                      ],
                    },
                  },
                  {
                    name: 'Change of Direction',
                    description: 'Agility and cutting ability',
                    day_offset: 2,
                    estimated_duration_minutes: 55,
                    session_exercises: {
                      create: [
                        { exercise_name: '5-10-5 Shuttle Drill', sets: 5, reps: '1', rest_seconds: 90, order_index: 1 },
                        { exercise_name: 'Cone Drills', sets: 4, reps: '3 patterns', rest_seconds: 60, order_index: 2 },
                        { exercise_name: 'Lateral Bounds', sets: 3, reps: '10 per side', rest_seconds: 60, order_index: 3 },
                      ],
                    },
                  },
                  {
                    name: 'Recovery & Mobility',
                    description: 'Active recovery for speed athletes',
                    day_offset: 5,
                    estimated_duration_minutes: 40,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Dynamic Stretching', sets: 1, reps: '20 min', rest_seconds: 0, order_index: 1 },
                        { exercise_name: 'Foam Rolling', sets: 1, reps: '15 min', rest_seconds: 0, order_index: 2 },
                      ],
                    },
                  },
                ],
              },
            },
            {
              name: 'Maximum Velocity',
              description: 'Top speed development',
              order_index: 2,
              week_start: 3,
              week_end: 4,
              program_sessions: {
                create: [
                  {
                    name: 'Top Speed Training',
                    description: 'Maximum velocity mechanics',
                    day_offset: 0,
                    estimated_duration_minutes: 65,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Flying 30s', sets: 5, reps: '1', rest_seconds: 180, order_index: 1 },
                        { exercise_name: 'Downhill Sprints (3% grade)', sets: 4, reps: '1', rest_seconds: 180, order_index: 2 },
                        { exercise_name: 'Bounding', sets: 3, reps: '30m', rest_seconds: 120, order_index: 3 },
                      ],
                    },
                  },
                  {
                    name: 'Speed Endurance',
                    description: 'Maintain speed under fatigue',
                    day_offset: 2,
                    estimated_duration_minutes: 60,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Repeat 40-Yard Sprints', sets: 8, reps: '1', rest_seconds: 45, order_index: 1 },
                        { exercise_name: 'Tempo Runs', sets: 1, reps: '100m x 6', rest_seconds: 60, order_index: 2 },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    }),

    // BASKETBALL - Vertical Jump Pro (10 weeks)
    prisma.programs.create({
      data: {
        coach_id: demoCoach.id,
        sport_id: sports[2].id,
        title: 'Vertical Jump Pro',
        description: 'Add 6-10 inches to your vertical jump with this NBA-trainer designed program.',
        goal_primary: 'explosiveness',
        level_target: 'amateur',
        duration_weeks: 10,
        sessions_per_week: 4,
        is_published: true,
        cover_image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
        program_blocks: {
          create: [
            {
              name: 'Strength Base',
              description: 'Build foundational leg strength',
              order_index: 1,
              week_start: 1,
              week_end: 3,
              program_sessions: {
                create: [
                  {
                    name: 'Heavy Leg Day',
                    description: 'Maximum strength development',
                    day_offset: 0,
                    estimated_duration_minutes: 75,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Back Squat', sets: 5, reps: '5', rest_seconds: 180, intensity_note: '85% 1RM', order_index: 1 },
                        { exercise_name: 'Romanian Deadlift', sets: 4, reps: '8', rest_seconds: 120, order_index: 2 },
                        { exercise_name: 'Bulgarian Split Squat', sets: 3, reps: '10 per leg', rest_seconds: 90, order_index: 3 },
                      ],
                    },
                  },
                  {
                    name: 'Plyometric Intro',
                    description: 'Basic jumping technique',
                    day_offset: 2,
                    estimated_duration_minutes: 50,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Box Jump (Low)', sets: 4, reps: '6', rest_seconds: 90, order_index: 1 },
                        { exercise_name: 'Depth Drop (Absorption)', sets: 3, reps: '5', rest_seconds: 120, order_index: 2 },
                        { exercise_name: 'Jump Rope', sets: 1, reps: '10 min', rest_seconds: 0, order_index: 3 },
                      ],
                    },
                  },
                ],
              },
            },
            {
              name: 'Explosive Phase',
              description: 'Convert strength to power',
              order_index: 2,
              week_start: 4,
              week_end: 7,
              program_sessions: {
                create: [
                  {
                    name: 'Power Development',
                    description: 'Explosive strength training',
                    day_offset: 0,
                    estimated_duration_minutes: 70,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Power Clean', sets: 5, reps: '3', rest_seconds: 180, order_index: 1 },
                        { exercise_name: 'Trap Bar Jump', sets: 4, reps: '5', rest_seconds: 120, order_index: 2 },
                        { exercise_name: 'Band-Resisted Jumps', sets: 3, reps: '6', rest_seconds: 90, order_index: 3 },
                      ],
                    },
                  },
                  {
                    name: 'Advanced Plyometrics',
                    description: 'High-intensity jumping drills',
                    day_offset: 2,
                    estimated_duration_minutes: 60,
                    session_exercises: {
                      create: [
                        { exercise_name: 'Depth Jump to Max Height', sets: 4, reps: '5', rest_seconds: 150, order_index: 1 },
                        { exercise_name: 'Hurdle Hops', sets: 3, reps: '5 hurdles', rest_seconds: 120, order_index: 2 },
                        { exercise_name: 'Single-Leg Bounds', sets: 3, reps: '8 per leg', rest_seconds: 90, order_index: 3 },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    }),
  ]);

  console.log(`✅ Created ${programs.length} full programs with blocks, sessions, and exercises`);

  // ==========================================
  // 7. CREATE SAMPLE ENROLLMENT FOR DEMO
  // ==========================================

  // 1. Create a dummy snapshot first to satisfy the foreign key constraint
  const dummySnapshot = await prisma.physical_snapshots.create({
    data: {
      user_id: demoAthlete.id,
      sport_id: sports[0].id,
      snapshot_type: 'program_baseline',
      notes: 'Initial baseline snapshot generated by seed',
    },
  });
  await prisma.snapshot_test_values.createMany({
    data: [
      {
        snapshot_id: dummySnapshot.id,
        attribute_test_id: tests[0].id,
        value: 7.5,
        unit: tests[0].unit,
      },
      {
        snapshot_id: dummySnapshot.id,
        attribute_test_id: tests[1].id,
        value: 480,
        unit: tests[1].unit,
      },
      {
        snapshot_id: dummySnapshot.id,
        attribute_test_id: tests[3].id,
        value: 95,
        unit: tests[3].unit,
      },
      {
        snapshot_id: dummySnapshot.id,
        attribute_test_id: tests[4].id,
        value: 10.8,
        unit: tests[4].unit,
      },
      {
        snapshot_id: dummySnapshot.id,
        attribute_test_id: tests[5].id,
        value: 9.7,
        unit: tests[5].unit,
      },
      {
        snapshot_id: dummySnapshot.id,
        attribute_test_id: tests[6].id,
        value: 240,
        unit: tests[6].unit,
      },
      {
        snapshot_id: dummySnapshot.id,
        attribute_test_id: tests[7].id,
        value: 82,
        unit: tests[7].unit,
      },
    ],
  });


  // 2. Create the enrollment using the real ID of the dummy snapshot
  const sampleEnrollment = await prisma.enrollments.create({
    data: {
      user_id: demoAthlete.id,
      program_id: programs[0].id,
      start_date: new Date('2026-07-01'),
      preferred_days: ['Monday', 'Wednesday', 'Friday'],
      preferred_time: new Date('1970-01-01T08:00:00Z'),
      status: 'active',
      baseline_snapshot_id: dummySnapshot.id,
    },
  });

  // 3. Update the snapshot to link back to the enrollment (maintaining the two-way relationship)
  await prisma.physical_snapshots.update({
    where: { id: dummySnapshot.id },
    data: { program_enrollment_id: sampleEnrollment.id },
  });

  console.log(`✅ Created sample enrollment for demo athlete`);

  // ==========================================
  // 8. SEED LEADERBOARD ATHLETES (Arabic Names)
  // ==========================================
  console.log('🏆 Seeding leaderboard athletes...');

  const seedAthletes = [
    { username: 'ahmad_boxer', email: 'ahmad@neofit.com', fullName: 'أحمد محمد الشريف', dob: '1998-03-15', category: 'middleweight' as const },
    { username: 'youssef_strong', email: 'youssef@neofit.com', fullName: 'يوسف عبدالله العمري', dob: '1997-07-22', category: 'middleweight' as const },
    { username: 'khaled_tiger', email: 'khaled@neofit.com', fullName: 'خالد إبراهيم الحربي', dob: '1999-01-10', category: 'middleweight' as const },
    { username: 'omar_thunder', email: 'omar@neofit.com', fullName: 'عمر سعد الغامدي', dob: '2000-11-05', category: 'middleweight' as const },
    { username: 'mohammed_champ', email: 'mohammed@neofit.com', fullName: 'محمد فهد القحطاني', dob: '1996-06-18', category: 'middleweight' as const },
    { username: 'sultan_iron', email: 'sultan@neofit.com', fullName: 'سلطان عبدالرحمن الدوسري', dob: '1998-09-30', category: 'middleweight' as const },
    { username: 'fahd_lightning', email: 'fahd@neofit.com', fullName: 'فهد ناصر المطيري', dob: '2001-02-14', category: 'middleweight' as const },
    { username: 'abdullah_fighter', email: 'abdullah@neofit.com', fullName: 'عبدالله خالد الشمري', dob: '1999-08-25', category: 'middleweight' as const },
    { username: 'saad_thunder', email: 'saad@neofit.com', fullName: 'سعد تركي العتيبي', dob: '1997-12-03', category: 'welterweight' as const },
    { username: 'nasser_steel', email: 'nasser@neofit.com', fullName: 'ناصر محمد الزهراني', dob: '2000-04-20', category: 'welterweight' as const },
    { username: 'turki_lion', email: 'turki@neofit.com', fullName: 'تركي سلطان السبيعي', dob: '1998-10-11', category: 'light_middleweight' as const },
    { username: 'bandar_fist', email: 'bandar@neofit.com', fullName: 'بندر عبدالعزيز الرشيدي', dob: '1999-05-07', category: 'super_middleweight' as const },
    { username: 'majed_speed', email: 'majed@neofit.com', fullName: 'ماجد حمد المالكي', dob: '2001-01-28', category: 'lightweight' as const },
    { username: 'rakan_rock', email: 'rakan@neofit.com', fullName: 'راكان فيصل الحارثي', dob: '1997-03-16', category: 'middleweight' as const },
    { username: 'hassan_storm', email: 'hassan@neofit.com', fullName: 'حسن علي الجهني', dob: '2000-07-09', category: 'middleweight' as const },
  ];

  // Randomized but realistic test value ranges for each boxing test
  // [0]=Med Ball Throw (m), [1]=Punch Force (kg), [2]=Punch Speed (m/s), [3]=30s Count (reps)
  // [4]=T-Test (s), [5]=Ladder (s), [6]=Reaction (ms), [7]=Slip Efficiency (%)
  const testValueRanges = [
    { min: 5.5, max: 10.0 },   // Med Ball Rotational Throw
    { min: 320, max: 620 },    // Punch Force Dynamometer
    { min: 8.0, max: 16.0 },   // Accelerometer Punch Speed
    { min: 60, max: 115 },     // 30-Second Punch Count
    { min: 8.5, max: 12.5 },   // T-Test Agility
    { min: 7.8, max: 11.2 },   // Ladder Drill Time
    { min: 180, max: 320 },    // Reaction Time Test
    { min: 55, max: 95 },      // Slip Line Efficiency
  ];

  // Deterministic pseudo-random seed based on index
  const getTestValue = (athleteIdx: number, testIdx: number): number => {
    const range = testValueRanges[testIdx];
    // Use a simple deterministic formula for variety
    const factor = ((athleteIdx * 7 + testIdx * 13 + 37) % 100) / 100;
    const value = range.min + (range.max - range.min) * factor;
    return Number(value.toFixed(2));
  };

  for (let i = 0; i < seedAthletes.length; i++) {
    const athlete = seedAthletes[i];

    const user = await prisma.users.create({
      data: {
        username: athlete.username,
        email: athlete.email,
        password_hash: '$2b$10$placeholder_hash_for_seed',
        role: 'athlete',
        full_name: athlete.fullName,
        date_of_birth: new Date(athlete.dob),
        bio: `ملاكم هاوي - ${athlete.category}`,
      },
    });

    await prisma.user_sport_profiles.create({
      data: {
        user_id: user.id,
        sport_id: sports[0].id,
        level: 'amateur',
        player_category: athlete.category,
        is_primary: true,
      },
    });

    const goals = ['Power', 'Strength', 'Speed', 'Endurance', 'General'] as const;
    await prisma.user_metrics.create({
      data: {
        user_id: user.id,
        height_cm: 170 + (i % 15),
        weight_kg: 68 + (i % 12),
        goal: goals[i % goals.length],
        training_days_per_week: 3 + (i % 4),
        years_training: 1.0 + (i % 8) * 0.5,
        has_injury_history: i % 5 === 0,
        endurance_score: 4 + (i % 6),
        strength_score: 5 + (i % 5),
        speed_score: 4 + (i % 7),
        flexibility_score: 3 + (i % 6),
        explosiveness_score: 5 + (i % 5),
        recovery_score: 4 + (i % 6),
      },
    });

    // Create a physical snapshot with test values for ALL 8 boxing tests
    const snapshot = await prisma.physical_snapshots.create({
      data: {
        user_id: user.id,
        sport_id: sports[0].id,
        snapshot_type: 'initial_onboarding',
        notes: `Baseline snapshot for ${athlete.fullName}`,
      },
    });

    // Add test values for all 8 boxing tests
    const snapshotTestData = [];
    for (let t = 0; t < 8; t++) {
      snapshotTestData.push({
        snapshot_id: snapshot.id,
        attribute_test_id: tests[t].id,
        value: getTestValue(i, t),
        unit: tests[t].unit,
      });
    }

    await prisma.snapshot_test_values.createMany({
      data: snapshotTestData,
    });
  }

  console.log(`✅ Created ${seedAthletes.length} leaderboard athletes with Arabic names`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('='.repeat(50));
  console.log('Summary:');
  console.log(`  - ${sports.length} Sports`);
  console.log(`  - ${attributes.length} Sport Attributes`);
  console.log(`  - ${tests.length} Attribute Tests`);
  console.log(`  - ${normativeDataEntries.length} Normative Data Entries`);
  console.log(`  - ${programs.length} Full Programs`);
  console.log(`  - ${seedAthletes.length + 2} Users (${seedAthletes.length} athletes + coach + demo athlete)`);
  console.log('='.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
