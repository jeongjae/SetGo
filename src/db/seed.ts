import { db } from './db';
import { inferExerciseProgressionStyle } from '../domain/exercises';
import type { ExerciseMaster } from '../types';

const now = () => new Date().toISOString();

const exercise = (
  id: string,
  nameKo: string,
  nameEn: string,
  category: ExerciseMaster['category'],
  icon: string,
  stage: ExerciseMaster['stage'] = 'main',
  categoryTags: ExerciseMaster['categoryTags'] = [category],
  stageTags: ExerciseMaster['stageTags'] = [stage],
  description?: string,
): ExerciseMaster => ({
  id,
  nameKo,
  nameEn,
  stage,
  stageTags,
  category,
  categoryTags,
  progressionStyle: inferExerciseProgressionStyle({ category, categoryTags }),
  description,
  defaultEmoji: icon,
  isDefault: true,
  isActive: true,
  createdAt: now(),
  updatedAt: now(),
});

export const defaultExercises: ExerciseMaster[] = [
  // 가슴
  exercise('bench_press', '벤치프레스', 'Bench Press', 'chest', 'CH', 'main', ['chest', 'triceps'], ['main'], '가슴(대흉근) 전체를 발달시키는 최고의 상체 복합 다관절 운동입니다. 견갑골을 벤치에 밀착시키고 안정적인 자세를 유지하세요.'),
  exercise('incline_bench_press', '인클라인 벤치프레스', 'Incline Bench Press', 'chest', 'CH', 'main', ['chest', 'shoulder', 'triceps'], ['main'], '윗가슴(대흉근 상부)을 발달시켜 탄탄한 가슴 라인을 만드는 운동입니다. 각도는 30도에서 40도가 적당합니다.'),
  exercise('chest_press', '체스트 프레스', 'Chest Press', 'chest', 'CH', 'main', ['chest', 'triceps'], ['main'], '머신을 이용하여 안전하게 가슴 근육을 고립시키고 자극을 극대화할 수 있는 초심자 추천 운동입니다.'),
  exercise('dumbbell_fly', '덤벨 플라이', 'Dumbbell Fly', 'chest', 'CH', 'main', ['chest'], ['main'], '덤벨을 사용하여 가슴 안쪽 라인을 다듬고 대흉근을 깊게 스트레칭하는 데 효과적인 고립 운동입니다.'),
  exercise('peck_deck_fly', '펙덱 플라이', 'Pec Deck Fly', 'chest', 'CH', 'main', ['chest'], ['main'], '머신을 이용해 가슴 근육의 수축과 이완을 안전하게 극대화하고 안쪽 가슴 라인을 강화하는 운동입니다.'),
  exercise('dips', '딥스', 'Dips', 'chest', 'CH', 'main', ['chest', 'triceps', 'shoulder'], ['main', 'cooldown'], '아랫가슴과 삼두근을 동시에 발달시키는 강력한 맨몸 상체 운동입니다. 어깨 관절 부상에 유의하며 진행하세요.'),

  // 등
  exercise('lat_pulldown', '랫풀다운', 'Lat Pulldown', 'back', 'BK', 'main', ['back', 'biceps'], ['main'], '광배근과 대원근을 타겟으로 하여 넓은 등을 만들어주는 운동입니다. 상체를 고정하고 날개뼈를 아래로 당긴다는 느낌으로 바를 쇄골 방향으로 당기세요.'),
  exercise('lat_pulldown_machine', '랫풀다운 (머신)', 'Lat Pulldown (Machine)', 'back', 'BK', 'main', ['back', 'biceps'], ['main'], '고정형 머신(블록 핀형)의 장력과 지정 궤적을 이용하여 광배근 전체를 안전하고 정밀하게 고립 단련하는 등 운동입니다.'),
  exercise('lat_pulldown_cable', '랫풀다운 (케이블)', 'Lat Pulldown (Cable)', 'back', 'BK', 'main', ['back', 'biceps'], ['main'], '케이블 도르래 머신을 이용하여 상하좌우 미세한 궤적 조절이 가능하도록 넓은 광배근을 타겟팅하는 등 운동입니다.'),
  exercise('lat_pulldown_plate', '랫풀다운 (기구)', 'Lat Pulldown (Plate Loaded)', 'back', 'BK', 'main', ['back', 'biceps'], ['main'], '원판 로드식(플레이트 로드형) 레버 기구를 사용하여 원판 무게감을 직관적으로 느끼며 등 바깥쪽 두께를 발달시키는 파워풀한 운동입니다.'),
  exercise('pull_up', '풀업', 'Pull-up', 'back', 'BK', 'main', ['back', 'bodyweight', 'biceps'], ['main'], '맨몸으로 등을 넓히고 상체 근력을 기르는 최강의 운동입니다. 코어를 조이고 광배근의 힘으로 몸을 끌어올리세요.'),
  exercise('seated_cable_row', '시티드 케이블 로우', 'Seated Cable Row', 'back', 'BK', 'main', ['back', 'biceps'], ['main'], '등 근육의 두께감을 더해주는 운동입니다. 허리를 곧게 펴고 케이블을 배꼽 쪽으로 수평하게 당기며 등을 강하게 쥐어짜세요.'),
  exercise('barbell_row', '바벨 로우', 'Bent-Over Barbell Row', 'back', 'BK', 'main', ['back', 'biceps'], ['main'], '등 전체의 두께감과 입체감을 발달시키는 바벨 운동입니다. 상체 각도를 숙인 상태에서 허리 정렬에 신경 쓰며 바벨을 당깁니다.'),
  exercise('dumbbell_row', '덤벨 로우', 'One-Arm Dumbbell Row', 'back', 'BK', 'main', ['back', 'biceps'], ['main'], '한 팔씩 덤벨을 당겨 좌우 등 근육의 대칭을 맞추고 깊은 자극을 가져갈 수 있는 덤벨 운동입니다.'),
  exercise('deadlift', '데드리프트', 'Conventional Deadlift', 'back', 'BK', 'main', ['back', 'legs'], ['main'], '전신 후면 사슬 근육 전체를 단련하고 강력한 코어와 파워를 형성하는 피트니스 3대 핵심 운동 중 하나입니다.'),

  // 어깨
  exercise('shoulder_press', '숄더 프레스', 'Shoulder Press', 'shoulder', 'SH', 'main', ['shoulder', 'triceps'], ['main'], '전면과 측면 삼각근을 고루 발달시켜 넓고 듬직한 어깨 프레임을 완성하는 필수 어깨 프레스 운동입니다.'),
  exercise('side_lateral_raise', '사이드 레터럴 레이즈', 'Side Lateral Raise', 'shoulder', 'SH', 'main', ['shoulder'], ['main'], '측면 삼각근을 집중 고립하여 입체감 있는 어깨 봉긋한 라인을 완성하는 최고의 운동입니다.'),
  exercise('military_press', '밀리터리 프레스', 'Military Press', 'shoulder', 'SH', 'main', ['shoulder', 'triceps'], ['main'], '바벨을 서서 머리 위로 밀어 올려 코어와 어깨 근육 전체의 협응력을 기르는 전통적인 프레스 운동입니다.'),
  exercise('bentover_lateral_raise', '벤트오버 레터럴 레이즈', 'Bent-Over Lateral Raise', 'shoulder', 'SH', 'main', ['shoulder'], ['main'], '상체를 숙여 후면 삼각근을 고립 자극함으로써 어깨 뒷면의 입체감을 완성하는 고립 운동입니다.'),
  exercise('face_pull', '페이스 풀', 'Face Pull', 'shoulder', 'SH', 'main', ['shoulder', 'back'], ['main', 'cooldown'], '케이블을 얼굴 쪽으로 당겨 후면 삼각근과 회전근개, 상부 승모근 등 어깨 후면 건강을 관리하는 최고의 운동입니다.'),

  // 팔 (이두/삼두)
  exercise('dumbbell_curl', '덤벨 컬', 'Dumbbell Curl', 'biceps', 'BI', 'main', ['biceps'], ['main'], '덤벨을 들어 올려 상완이두근의 볼륨감을 발달시키는 가장 대중적인 이두 운동입니다. 팔꿈치를 옆구리에 잘 고정하세요.'),
  exercise('barbell_curl', '바벨 컬', 'Barbell Curl', 'biceps', 'BI', 'main', ['biceps'], ['main'], '바벨을 사용해 이두근 전체에 고중량 자극을 주고 두툼한 앞팔을 형성하는 강력한 팔 운동입니다.'),
  exercise('hammer_curl', '해머 컬', 'Hammer Curl', 'biceps', 'BI', 'main', ['biceps'], ['main'], '덤벨을 세로로 쥐어 이두근 외측과 상완요골근을 자극하여 팔 전체의 볼륨과 두께를 보강하는 이두 운동입니다.'),
  exercise('cable_pushdown', '케이블 푸시다운', 'Cable Pushdown', 'triceps', 'TR', 'main', ['triceps'], ['main'], '케이블을 아래로 밀어 내려 삼두근 외측두와 내측두를 선명하게 발달시키는 대중적인 삼두 운동입니다.'),
  exercise('lying_triceps_extension', '라잉 트라이셉스 익스텐션', 'Lying Triceps Extension', 'triceps', 'TR', 'main', ['triceps'], ['main'], '누운 자세에서 이마 방향으로 바벨을 내렸다 올리며 상완삼두근 장두의 거대한 볼륨을 만들어내는 대표적인 삼두 운동입니다.'),
  exercise('overhead_triceps_extension', '오버헤드 삼두 익스텐션', 'Overhead Triceps Extension', 'triceps', 'TR', 'main', ['triceps'], ['main'], '덤벨이나 케이블을 머리 뒤에서 위로 들어 올려 삼두근 장두 부위를 강력하게 스트레칭 및 수축하는 운동입니다.'),

  // 하체
  exercise('barbell_squat', '바벨 스쿼트', 'Barbell Squat', 'legs', 'LG', 'main', ['legs'], ['main'], '대퇴사두근과 둔근 등 하체 전반과 코어를 단련하여 신체 대사량과 체력을 극대화하는 최고의 웨이트 트레이닝 운동입니다.'),
  exercise('leg_press', '레그 프레스', 'Leg Press', 'legs', 'LG', 'main', ['legs'], ['main'], '발판을 밀어내어 허리에 무리 없이 대퇴사두근과 둔근에 고중량 자극을 줄 수 있는 하체 머신 운동입니다.'),
  exercise('romanian_deadlift', '루마니안 데드리프트', 'Romanian Deadlift', 'legs', 'LG', 'main', ['legs', 'back'], ['main'], '대퇴이두근(허벅지 뒤편)과 둔근, 척추기립근을 집중 발달시켜 탄탄한 후면 라인을 다듬는 데드리프트 변형 동작입니다.'),
  exercise('leg_extension', '레그 익스텐션', 'Leg Extension', 'legs', 'LG', 'main', ['legs'], ['main'], '대퇴사두근(허벅지 앞쪽)을 단일 고립하여 디테일한 근육 갈래와 선명도를 살리는 하체 머신 운동입니다.'),
  exercise('lying_leg_curl', '라잉 레그 컬', 'Lying Leg Curl', 'legs', 'LG', 'main', ['legs'], ['main'], '엎드려 다리를 당겨 허벅지 뒤쪽(햄스트링) 근육을 완벽하게 고립하고 발달시키는 대표적인 하체 고립 운동입니다.'),
  exercise('calf_raise', '카프 레이즈', 'Standing Calf Raise', 'legs', 'LG', 'main', ['legs'], ['main', 'cooldown'], '뒤꿈치를 들어 올려 종아리 근육(비복근, 가자미근)의 탄력과 발목 안정성을 극대화시키는 운동입니다.'),

  // 복근/코어
  exercise('crunch', '크런치', 'Crunch', 'bodyweight', 'BW', 'main', ['bodyweight'], ['main'], '상부 복직근을 집중적으로 쥐어짜 선명하고 탄탄한 복근 라인을 만드는 데 기여하는 대표적인 복부 운동입니다.'),
  exercise('hanging_leg_raise', '행잉 레그 레이즈', 'Hanging Leg Raise', 'bodyweight', 'BW', 'main', ['bodyweight'], ['main'], '철봉에 매달려 다리를 올리며 하부 복직근과 코어 근력을 강력하게 활성화하는 상급 복부 트레이닝입니다.'),
  exercise('plank', '플랭크', 'Plank', 'bodyweight', 'BW', 'main', ['bodyweight'], ['main', 'cooldown'], '몸을 일직선으로 곧게 펴고 버텨 복부 내 심부 코어 근육과 전신 협응력을 극대화시키는 정적 버티기 운동입니다.'),

  // 맨손/모빌리티
  exercise('joint_mobility', '관절 가동성', 'Joint Mobility', 'mobility', 'MO', 'warmup', ['mobility'], ['warmup', 'cooldown'], '운동 전후 관절의 부드러운 움직임을 회복하고 부상을 예방하는 필수 스트레칭 동작입니다.'),
  exercise('push_up', '푸시업', 'Push-up', 'bodyweight', 'BW', 'warmup', ['bodyweight', 'chest', 'triceps'], ['warmup', 'main'], '준비운동, 맨손 가슴 운동, 마무리 운동으로 유연하게 활용 가능한 최고의 맨몸 상체 다관절 운동입니다.'),
  exercise('bodyweight_squat', '맨몸 스쿼트', 'Bodyweight Squat', 'bodyweight', 'BW', 'warmup', ['bodyweight', 'legs'], ['warmup', 'main'], '무게 없이 자신의 체중만을 이용해 스쿼트 자세를 익히고 하체 관절을 웜업하는 훌륭한 맨손 하체 운동입니다.'),
  exercise('lunge', '런지', 'Lunge', 'bodyweight', 'BW', 'main', ['bodyweight', 'legs'], ['main'], '한쪽 다리를 번갈아 내딛으며 허벅지, 둔근의 균형 발달과 좌우 균형감각을 기르는 최고의 편측성 하체 운동입니다.'),

  // 유산소
  exercise('treadmill', '트레드밀', 'Treadmill', 'cardio', 'CA', 'warmup', ['cardio'], ['warmup', 'main'], '러닝머신을 달려 심폐 지구력을 향상시키고 높은 체지방 연소 효율을 지닌 가장 보편적인 유산소 운동입니다.'),
  exercise('indoor_bike', '실내 자전거', 'Indoor Bike', 'cardio', 'CA', 'warmup', ['cardio'], ['warmup', 'main'], '관절의 큰 충격 없이 대퇴근 발달과 심폐 지구력을 안전하게 향상시킬 수 있는 실내 유산소 기구입니다.'),
  exercise('outdoor_running', '야외 러닝', 'Outdoor Running', 'cardio', 'CA', 'main', ['cardio'], ['main'], '야외의 맑은 공기를 마시며 전신을 흔들어 열량 소모와 활력을 극대화하는 야외 유산소 운동입니다.'),
  exercise('stair_climber', '천국의 계단', 'Stair Climber', 'cardio', 'CA', 'main', ['cardio'], ['main'], '끝없는 계단을 오르는 모방 동작으로, 엄청난 칼로리 소모와 힙업 효과를 동시에 자아내는 지옥의 인기 유산소 기구입니다.'),
  exercise('elliptical', '엘립티컬', 'Elliptical', 'cardio', 'CA', 'main', ['cardio'], ['main'], '관절 충격이 거의 없도록 타원형 궤적을 그리며 상하체를 함께 흔드는 전신 고효율 유산소 운동기구입니다.'),
];

export async function seedDefaultExercises() {
  const existingExercises = await db.exercises.toArray();
  const existingIds = new Set(existingExercises.map((item) => item.id));
  const missingExercises = defaultExercises.filter((item) => !existingIds.has(item.id));

  if (missingExercises.length > 0) {
    await db.exercises.bulkPut(missingExercises);
  }

  const canonicalById = new Map(defaultExercises.map((item) => [item.id, item]));
  const defaultExerciseIds = new Set(defaultExercises.map((item) => item.id));
  const nameEnCounts = existingExercises.reduce<Record<string, number>>((counts, exerciseItem) => {
    if (!defaultExerciseIds.has(exerciseItem.id)) return counts;
    const normalizedName = (exerciseItem.nameEn ?? '').trim().toLowerCase();
    if (!normalizedName) return counts;
    counts[normalizedName] = (counts[normalizedName] ?? 0) + 1;
    return counts;
  }, {});

  const repairCandidates = existingExercises
    .filter((exerciseItem) => defaultExerciseIds.has(exerciseItem.id))
    .filter((exerciseItem) => {
      const canonical = canonicalById.get(exerciseItem.id);
      if (!canonical) return false;

      const nameEn = (exerciseItem.nameEn ?? '').trim();
      const nameKo = exerciseItem.nameKo.trim();
      const duplicatedEnglishName = nameEn ? (nameEnCounts[nameEn.toLowerCase()] ?? 0) > 1 : false;
      const barbellCurlLeak = canonical.nameEn !== 'Barbell Curl'
        && (nameEn === 'Barbell Curl' || nameKo === '바벨 컬');

      return !nameEn
        || !nameKo
        || duplicatedEnglishName
        || barbellCurlLeak
        || exerciseItem.progressionStyle !== canonical.progressionStyle;
    })
    .map((exerciseItem) => {
      const canonical = canonicalById.get(exerciseItem.id);
      if (!canonical) return exerciseItem;

      return {
        ...exerciseItem,
        nameKo: canonical.nameKo,
        nameEn: canonical.nameEn,
        category: canonical.category,
        categoryTags: canonical.categoryTags,
        progressionStyle: canonical.progressionStyle,
        stage: canonical.stage,
        stageTags: canonical.stageTags,
        defaultEmoji: canonical.defaultEmoji,
        description: exerciseItem.description || canonical.description,
        isActive: true,
        updatedAt: now(),
      };
    });

  if (repairCandidates.length > 0) {
    await db.exercises.bulkPut(repairCandidates);
  }
}
