import { addDays, clampNumber, formatDate } from '@/utils/dateUtils'

export const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30]

export function getNextReviewDate(baseDate = formatDate(), stage = 0) {
  const safeStage = clampNumber(stage, 0, EBBINGHAUS_INTERVALS.length - 1)
  return addDays(baseDate, EBBINGHAUS_INTERVALS[safeStage])
}

export function getNextStage(currentStage = 0, proficiency = 3) {
  if (proficiency >= 4) {
    return clampNumber(currentStage + 1, 0, EBBINGHAUS_INTERVALS.length - 1)
  }

  if (proficiency <= 2) {
    return 0
  }

  return clampNumber(currentStage, 0, EBBINGHAUS_INTERVALS.length - 1)
}

export function isReviewDue(record, today = formatDate()) {
  return Boolean(record?.nextReviewDate) && record.nextReviewDate <= today && record.status !== 'mastered'
}

