#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const curriculum = readJson('data/curriculum.json')
const questions = readJson('data/questions.json')
const answers = readJson('data/answers.json')
const amscoOutline = readJson('data/amsco_outline.json')

const unitTopicCounts = parseUnitTopicCounts(readFileSync(join(root, 'lib/constants.ts'), 'utf8'))
const failures = []

const curriculumTopics = []
for (const unit of curriculum.units ?? []) {
  const unitNumber = Number(unit.number)
  const topics = unit.topics ?? []
  const declaredCount = Number(unit.topic_count)
  const constantCount = unitTopicCounts.get(unitNumber)

  if (declaredCount !== topics.length) {
    failures.push(`Unit ${unitNumber}: topic_count=${declaredCount}, actual topics=${topics.length}`)
  }
  if (constantCount !== topics.length) {
    failures.push(`Unit ${unitNumber}: UNIT_TOPIC_COUNTS=${constantCount}, actual topics=${topics.length}`)
  }

  for (const topic of topics) {
    curriculumTopics.push({
      unit: unitNumber,
      id: String(topic.id),
      title: topic.title,
      resources: topic.resources ?? [],
    })
  }
}

const curriculumIds = new Set(curriculumTopics.map(topic => topic.id))
const questionTopics = new Map((questions.topics ?? []).map(topic => [String(topic.topic), topic]))
const answerTopics = new Map((answers.topics ?? []).map(topic => [String(topic.topic), topic]))

for (const topic of curriculumTopics) {
  if (!questionTopics.has(topic.id)) failures.push(`${topic.id}: missing questions.json entry`)
  if (!answerTopics.has(topic.id)) failures.push(`${topic.id}: missing answers.json entry`)
  if (topic.resources.length === 0) failures.push(`${topic.id}: missing curriculum resources`)

  const question = questionTopics.get(topic.id)
  const answer = answerTopics.get(topic.id)
  if (question && answer && !hasQuizCoverage(question, answer)) {
    failures.push(`${topic.id}: no usable MCQ/SAQ/reflection/skill quiz coverage`)
  }
}

for (const id of questionTopics.keys()) {
  if (!curriculumIds.has(id)) failures.push(`${id}: questions.json topic is not in curriculum.json`)
}
for (const id of answerTopics.keys()) {
  if (!curriculumIds.has(id)) failures.push(`${id}: answers.json topic is not in curriculum.json`)
}

const amscoTopicIds = new Set()
const amscoUnits = Array.isArray(amscoOutline)
  ? amscoOutline.filter(node => /^UNIT\s+\d+|^Unit\s+\d+/i.test(node.name))
  : []

if (amscoUnits.length !== (curriculum.units ?? []).length) {
  failures.push(`AMSCO outline units=${amscoUnits.length}, curriculum units=${(curriculum.units ?? []).length}`)
}

for (const [index, unit] of amscoUnits.entries()) {
  const unitNumber = index + 1
  const topicNodes = (unit.children ?? []).filter(child => !/review/i.test(child.name))
  for (const topicNode of topicNodes) {
    const topicId = extractTopicId(topicNode.name)
    if (!topicId) {
      failures.push(`AMSCO Unit ${unitNumber}: could not parse topic id from "${topicNode.name}"`)
      continue
    }
    amscoTopicIds.add(topicId)
    if (!curriculumIds.has(topicId)) {
      failures.push(`${topicId}: AMSCO outline topic is not in curriculum.json`)
    }
  }
}

for (const id of curriculumIds) {
  if (!amscoTopicIds.has(id)) failures.push(`${id}: missing AMSCO outline topic node`)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`ok - ${curriculumTopics.length} curriculum topics have resources, questions, and answers`)

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'))
}

function extractTopicId(name) {
  const match = String(name).match(/^(?:Topic\s+)?(\d+\.\d+)\b/i)
  return match ? match[1] : null
}

function hasQuizCoverage(question, answer) {
  const hasMcq =
    Array.isArray(question.mcq?.questions) &&
    question.mcq.questions.length > 0 &&
    Array.isArray(answer.mcq_answers) &&
    answer.mcq_answers.length === question.mcq.questions.length

  const hasSaq =
    Array.isArray(question.saq) &&
    question.saq.length > 0 &&
    answer.saq_responses &&
    typeof answer.saq_responses === 'object'

  const hasReflection =
    typeof question.reflect?.question === 'string' &&
    typeof answer.reflect_response === 'string'

  const hasSkill =
    Array.isArray(question.skill_questions) &&
    question.skill_questions.length > 0 &&
    Array.isArray(answer.skill_responses) &&
    answer.skill_responses.length === question.skill_questions.length

  return hasMcq || hasSaq || hasReflection || hasSkill
}

function parseUnitTopicCounts(source) {
  const match = source.match(/UNIT_TOPIC_COUNTS:[\s\S]*?=\s*{([\s\S]*?)}/)
  if (!match) throw new Error('Could not find UNIT_TOPIC_COUNTS in lib/constants.ts')

  const counts = new Map()
  for (const item of match[1].split(',')) {
    const part = item.trim()
    if (!part) continue
    const entry = part.match(/^(\d+):\s*(\d+)$/)
    if (!entry) throw new Error(`Could not parse UNIT_TOPIC_COUNTS entry: ${part}`)
    counts.set(Number(entry[1]), Number(entry[2]))
  }
  return counts
}
