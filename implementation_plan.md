# Asynchronous Score Calculation using BullMQ

We want to offload the compute-heavy user physical score recalculation tasks to an asynchronous background queue. This ensures that response times for key user actions (completing onboarding, submitting snapshots, enrolling/completing programs) remain fast, as the database-intensive norm lookups and math calculations will run out-of-band.

## User Review Required

> [!IMPORTANT]
> - This implementation requires installing `bullmq` as a dependency.
> - BullMQ requires Redis. We will use the existing `REDIS_URL` configured in the `.env` file (`redis://localhost:6379`).
> - The BullMQ Worker will run inside the main application process (initialized during `server.ts` startup) for simplicity and consistency.

## Proposed Changes

### Queue Configuration & Worker

#### [NEW] [metrics.queue.ts](file:///d:/NewFit-workspace/backend-node/src/queues/metrics.queue.ts)
- Initialize a Redis connection dedicated for BullMQ with `maxRetriesPerRequest: null`.
- Define a queue named `metrics-recalculation`.
- Define a worker that processes jobs of recalculating user scores by calling `computeAndSavePhysicalScores(userId, sportId)`.
- Export an `addMetricsJob(userId: string, sportId: number)` helper function.

#### [MODIFY] [server.ts](file:///d:/NewFit-workspace/backend-node/src/server.ts)
- Import the metrics queue/worker module to ensure the worker starts running when the server starts.

---

### API Controllers

#### [MODIFY] [athlete.controller.ts](file:///d:/NewFit-workspace/backend-node/src/controllers/athlete.controller.ts)
- **`createSnapshot`**: Enqueue score recalculation job after successful transaction.
- **`completeOnboarding`**: Fix the check for `existingProfile` so it runs before creating the new profile, and enqueue score recalculation job after successful transaction.

#### [MODIFY] [programs.controller.ts](file:///d:/NewFit-workspace/backend-node/src/controllers/programs.controller.ts)
- **`enrollInProgram`**: Enqueue score recalculation job after successful transaction.
- **`completeEnrollment`**: Enqueue score recalculation job after successful transaction.

---

## Verification Plan

### Automated Tests
- Run `npm run dev` to ensure compilation and server startup succeed.
- Verify Redis connection for BullMQ prints logs indicating connection success.

### Manual Verification
- We can trigger snapshots and onboarding via API requests and monitor console logs from the BullMQ Worker executing the calculations asynchronously.
