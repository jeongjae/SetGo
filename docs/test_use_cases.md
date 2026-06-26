# SetGo 테스트 유스케이스

## 자동 검증

항상 다음 명령을 통과해야 한다.

```powershell
npm.cmd run test -- --run
npm.cmd run build
npm.cmd run test:viewport
```

## Scenario 1. Maintenance B 세션 80% 추천

사전 조건:

- Upper A: `family=upper`, `intensityPhase=hypertrophy`
- Upper B: `family=upper`, `intensityPhase=maintenance`

절차:

1. Upper A에서 Bench Press 100kg working set을 완료한다.
2. 세션을 완료한다.
3. 다음 추천 또는 Upper B 운동을 시작한다.

기대 결과:

- Bench Press 추천 중량은 80kg이다.
- 추천 반복수는 12회이다.
- 추천 reason은 light/maintenance 성격을 설명한다.
- confidence는 matching hypertrophy 기록이 있으면 high이다.

자동 테스트 근거:

- `src/domain/recommendations.test.ts`

## Scenario 2. Deload 적용

사전 조건:

- 현재 루틴 day의 `intensityPhase=deload`
- 동일 운동 최근 working set 기록이 존재한다.

절차:

1. deload day 운동을 시작한다.
2. 추천 세트와 중량을 확인한다.

기대 결과:

- 중량은 최근 기준 약 80%이다.
- 세트 수는 최근 기준 약 50%이다.
- RIR은 보수적으로 높게 잡힌다.
- recovery percent가 낮아도 deload에는 추가 세트 감소를 중복 적용하지 않는다.

자동 테스트 근거:

- `src/domain/recommendations.test.ts`
- `src/domain/recommendation.test.ts`

## Scenario 3. Global Maintenance 목표

사전 조건:

- More 화면의 전역 목표가 maintenance이다.
- 최근 hypertrophy 기록에서 목표 반복 상단을 달성했다.

절차:

1. 같은 운동이 포함된 hypertrophy day를 시작한다.
2. 추천 중량을 확인한다.

기대 결과:

- 목표 반복 상단을 달성했어도 중량을 올리지 않는다.
- reason은 maintenance 목표 때문에 중량을 유지한다고 설명한다.

자동 테스트 근거:

- `src/domain/recommendations.test.ts`
- `src/domain/recommendation.test.ts`

## Scenario 4. Recovery 기반 세트 감소

사전 조건:

- 해당 운동의 주요 근육군 중 하나가 recovery percent 50% 미만이다.
- 현재 phase는 deload가 아니다.

절차:

1. 해당 근육군을 쓰는 운동을 시작하거나 기존 운동 로그를 연다.
2. 추천 세트 수를 확인한다.

기대 결과:

- 추천 working set이 1개 감소한다.
- confidence가 high였던 추천은 medium으로 낮아진다.
- reason에 낮은 recovery로 세트를 줄였다는 설명이 포함된다.

자동 테스트 근거:

- `src/domain/recommendations.test.ts`
- workout 생성 경로: `src/db/workouts.ts`

## Scenario 5. Cardio Auto-Skip

사전 조건:

- cycle 순서가 `Upper -> Running -> Lower`이다.
- Upper 세션 안에 distance가 0보다 큰 cardio record를 저장한다.

절차:

1. Upper 세션을 완료한다.
2. Today 화면으로 돌아간다.
3. Actuals 또는 Calendar에서 해당 날짜 기록을 확인한다.

기대 결과:

- Running item은 자동으로 skipped workout session으로 기록된다.
- skipped session은 `autoSkipped=true`, `skipReason=companion_cardio_completed`, `entryKind=running`이다.
- 다음 추천은 Running이 아니라 Lower이다.
- free workout 완료는 cycle을 전진시키지 않는다.

자동 테스트 근거:

- cycle 추천: `src/db/routines.ts`
- 완료 후 기록: `src/db/workouts.ts`

## Scenario 6. Myo-Reps Hard Set 정규화

절차:

1. 한 운동에 일반 hard set 1개와 myo-reps mini set 4개를 완료한다.
2. Stats와 Actuals의 hard set 수를 확인한다.

기대 결과:

- 실제 완료 세트 수는 5개로 유지된다.
- hard set 통계는 2개로 표시된다.
- 볼륨은 입력한 모든 세트를 기준으로 계산된다.

자동 테스트 근거:

- `src/domain/stats.test.ts`
- `src/domain/recommendation.test.ts`

## Scenario 7. Mobile Viewport

절차:

1. viewport smoke test를 실행한다.
2. 375px, 390px, 427px 결과를 확인한다.

기대 결과:

- 각 viewport에서 bottom tab은 5개이다.
- horizontal overflow는 1px 이하이다.
- console error는 0개이다.
