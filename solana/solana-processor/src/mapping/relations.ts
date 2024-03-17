import {maybeLast} from '@subsquid/util-internal'
import {Block, Transaction} from './items'


export function setUpRelations(block: Block): void {
    block.transactions.sort((a, b) => a.transactionIndex - b.transactionIndex)
    block.instructions.sort(instructionCompare)
    block.logs.sort((a, b) => a.transactionIndex - b.transactionIndex || a.logIndex - b.logIndex)

    let txs: (Transaction | undefined)[] = new Array((maybeLast(block.transactions)?.transactionIndex ?? -1) + 1)
    for (let tx of block.transactions) {
        txs[tx.transactionIndex] = tx
    }

    for (let i = 0; i < block.instructions.length; i++) {
        let ins = block.instructions[i]
        let tx = txs[ins.transactionIndex]
        if (tx) {
            ins.transaction = tx
            tx.instructions.push(ins)
        }
        for (let j = i + 1; j < block.instructions.length; j++) {
            let next = block.instructions[j]
            if (isInner(ins, next)) {
                ins.inner.push(next)
                if (ins.instructionAddress.length + 1 == next.instructionAddress.length) {
                    next.parent = ins
                }
            } else {
                break
            }
        }
    }

    for (let log of block.logs) {
        log.transaction = txs[log.transactionIndex]
        for (let i = bisectInstructions(block.instructions, log); i < block.instructions.length; i++) {
            let ins = block.instructions[i]
            if (isInner(ins, log)) {
                ins.logs.push(log)
                if (ins.instructionAddress.length == log.instructionAddress.length) {
                    log.instruction = ins
                }
            }
        }
    }
}


interface InstructionAddress {
    transactionIndex: number
    instructionAddress: number[]
}


function isInner(parent: InstructionAddress, inner: InstructionAddress): boolean {
    if (parent.transactionIndex != inner.transactionIndex) return false
    if (parent.instructionAddress.length > inner.instructionAddress.length) return false
    for (let i = 0; i < parent.instructionAddress.length; i++) {
        if (parent.instructionAddress[i] != inner.instructionAddress[i]) return false
    }
    return true
}


function instructionCompare(a: InstructionAddress, b: InstructionAddress): number {
    return a.transactionIndex - b.transactionIndex || addressCompare(a.instructionAddress, b.instructionAddress)
}


function bisectInstructions(ins: InstructionAddress[], a: InstructionAddress): number {
    let beg = 0
    let end = ins.length
    while (beg + 1 < end) {
        let dist = end - beg
        let pos = beg + (dist - (dist % 2)) / 2
        let i = ins[pos]
        let order = instructionCompare(i, a)
        if (order == 0) return pos
        if (order > 0) {
            end = pos
        } else {
            beg = pos
        }
    }
    return beg
}


function addressCompare(a: number[], b: number[]): number {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        let order = a[i] - b[i]
        if (order) return order
    }
    return a.length - b.length
}