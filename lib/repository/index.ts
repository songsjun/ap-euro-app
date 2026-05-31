import { DexieRepository } from './dexie.repo'
import type { IRepository } from './interface'

export const repo: IRepository = new DexieRepository()
export type { IRepository }
