# Smart Crew Assignment

https://github.com/MohamedAli077/fleet-navigator

FEATURE 8 — AUTOMATIC RESOURCE ASSIGNMENT

========================================================

Implement actual automatic resource assignment.

For every scheduled trip:

1. Identify candidate buses.

2. Remove unavailable buses.

3. Remove maintenance/retired/inactive buses.

4. Check depot/resource constraints.

5. Identify candidate crew.

6. Remove unavailable/off-duty/inactive crew.

7. Check timing conflicts.

8. Check overlapping assignments.

9. Generate feasible combinations.

10. Select the best feasible assignment.

At minimum, ensure:

- no bus is assigned to overlapping trips

- no crew member is assigned to overlapping trips

- inactive buses are never assigned

- retired buses are never assigned

- unavailable crew is never assigned

The assignment logic should be implemented as actual backend/business logic.

Do NOT fake it with frontend selection only.

========================================================

FEATURE 9 — RESOURCE ASSIGNMENT SCORE

========================================================

When multiple feasible resources are available, use a simple deterministic scoring approach.

For example, consider:

- availability

- depot proximity

- current utilization

- idle time

- schedule compatibility

Choose the best feasible resource.

Do not claim "AI optimization" unless an actual ML/optimization algorithm is implemented.

It is acceptable to call this:

"Automatic Resource Assignment"

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/02c1ef99-99db-4f89-a9e5-344dc87c95c9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
