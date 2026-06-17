import { RemoteProgressRepository } from './remote.repo'
import type { IRepository } from './interface'

export const repo: IRepository = new RemoteProgressRepository()
export type { IRepository }
