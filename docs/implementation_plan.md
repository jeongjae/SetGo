# SetGo 구현 계획

## 목표

SetGo는 고정된 요일표가 아니라 사용자의 실제 완료 기록을 기준으로 다음 운동을 제안한다. 루틴은 2분할, 3분할, 4분할, 5분할 등 어떤 구조여도 `family`와 `intensityPhase`를 통해 같은 추천 엔진을 사용한다.

## 핵심 설계

### 1. 루틴 day 메타데이터

모든 `RoutineDay`는 다음 메타데이터를 가질 수 있다.

- `family`: upper, lower, push, pull, legs, full_body 등 같은 계열을 묶는 값
- `intensityPhase`: `hypertrophy`, `maintenance`, `deload`, `cardio`

완료 기준:

- 루틴 설정 화면에서 day별 family와 phase를 수정할 수 있다.
- 기존 루틴은 마이그레이션 또는 기본값으로 `hypertrophy`를 가진다.
- 추천 엔진은 현재 day의 family/phase를 입력으로 받는다.

### 2. Flexible Cycle Scheduling

`RoutineCyclePlanItem`은 날짜에 강하게 묶이지 않는 순서 큐다. 오늘 추천은 최신 완료 세션의 `cyclePlanItemId` 또는 `routineDayId`를 기준으로 다음 item을 찾는다.

완료 기준:

- 루틴 세션이 완료되면 다음 cycle item이 추천된다.
- free workout은 cycle pointer를 전진시키지 않는다.
- 사용자가 근력 세션 안에서 cardio를 기록했고 다음 item이 running이면, running item은 자동 skipped 세션으로 기록되고 다음 item이 추천된다.
- 자동 skipped 세션은 `autoSkipped: true`, `skipReason: companion_cardio_completed`, `entryKind: running`을 가진다.

### 3. Adaptive Recommendation Engine

운동별 추천은 `recommendExerciseTarget`이 담당한다. 실제 workout 생성, 운동 추가, 기존 로그 표시 모두 같은 엔진을 사용한다.

입력:

- 루틴 계획 세트/반복/중량/RIR
- 최근 완료 운동 기록
- 현재 루틴 day의 `family`와 `intensityPhase`
- 전역 목표 `hypertrophy` 또는 `maintenance`
- 해당 운동이 쓰는 근육군 중 최저 recovery percent

완료 기준:

- 기록이 없으면 루틴 계획값을 사용한다.
- hypertrophy phase에서 목표 반복 상단을 달성했고 RIR 1-3이면 증량한다.
- 전역 목표가 maintenance면 hypertrophy phase에서도 증량하지 않는다.
- maintenance phase는 같은 family의 최근 hypertrophy 세션 기준 80% 중량과 12회 반복을 추천한다.
- deload phase는 최근 중량 80%, 세트 약 50%, 높은 RIR을 추천한다.
- recovery percent가 50% 미만이면 deload를 제외하고 working set을 1개 줄인다.

### 4. 고급 세트 기법

`WorkoutSet.intensityTechnique`은 `straight`, `drop_set`, `myo_reps`를 지원한다.

완료 기준:

- Workout 화면에서 세트 기법을 순환 선택할 수 있다.
- myo-reps mini set 여러 개는 hard set 통계에서 1개 hard set으로 정규화한다.
- 실제 입력 세트 수와 볼륨은 보존하고, hard set 집계만 정규화한다.

### 5. Cardio 입력

Cardio 기록은 독립 running 세션과 근력 세션 안의 companion cardio 모두를 지원한다.

완료 기준:

- distance, duration, speed, incline은 draft 상태에서도 안전하게 저장된다.
- speed/incline은 nullable 입력을 허용한다.
- companion cardio가 있으면 바로 다음 running cycle item을 자동 skipped로 기록한다.

### 6. UI/UX 기준

모바일 PWA를 우선한다.

완료 기준:

- 375px, 390px, 427px viewport에서 horizontal overflow가 1px 이하이다.
- bottom navigation은 5개 탭을 유지한다.
- 추천 카드에는 phase와 추천 근거가 표시된다.
- 한국어/영어 라벨은 깨진 문자 없이 표시된다.

## 구현 상태

- 추천 엔진 정본: `src/domain/recommendations.ts`
- 호환 래퍼: `src/domain/recommendation.ts`
- 실제 workout 연결: `src/db/workouts.ts`
- cycle scheduling: `src/db/routines.ts`
- hard set 통계 정규화: `src/domain/stats.ts`, `src/pages/ActualsPage.tsx`

## 남은 개선 후보

- 자동 deload 감지와 수락/거절 UI는 수동 deload 적용과 별도 단계로 구현한다.
- auto-skip 기록을 Calendar 화면에서 별도 배지로 더 명확히 보여줄 수 있다.
- 추천 reason을 한국어/영어 i18n 키로 분리할 수 있다.
