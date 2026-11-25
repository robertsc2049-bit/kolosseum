// The block-complete award's rule, on its own so it can be tested without a
// database. A block is finished when the athlete has done its last session
// and at least three quarters of its sessions (a competition date can skip
// some); a session counts when at least one of its exercises was done. Only
// blocks of two weeks or more count, so a single easy week isn't an award.
// The award says the block was finished - nothing about how strong anyone is.
export const MIN_AWARD_WEEKS = 2;
export const MIN_AWARD_SHARE = 0.75;

export type AwardSlot = Readonly<{ block_id: string; block_name: string; week_key: string }>;
export type FinishedBlock = Readonly<{ block_id: string; block_name: string; weeks: number; sessions_total: number; indexes: readonly number[] }>;

// Each block of two weeks or more whose last session is done, with enough of
// the sessions before it. `done` holds programme session indexes.
export function finishedBlocks(slots: readonly AwardSlot[], done: ReadonlySet<number>): FinishedBlock[] {
  const blocks: Array<{ block_id: string; block_name: string; weeks: Set<string>; indexes: number[] }> = [];
  slots.forEach((slot, index) => {
    if (!slot.block_id) return;
    let block = blocks[blocks.length - 1];
    if (!block || block.block_id !== slot.block_id) {
      block = { block_id: slot.block_id, block_name: slot.block_name, weeks: new Set<string>(), indexes: [] };
      blocks.push(block);
    }
    block.weeks.add(slot.week_key);
    block.indexes.push(index);
  });
  return blocks
    .filter((block) => block.weeks.size >= MIN_AWARD_WEEKS)
    .filter((block) => done.has(block.indexes[block.indexes.length - 1]))
    .filter((block) => block.indexes.filter((index) => done.has(index)).length >= Math.ceil(block.indexes.length * MIN_AWARD_SHARE))
    .map((block) => ({ block_id: block.block_id, block_name: block.block_name, weeks: block.weeks.size, sessions_total: block.indexes.length, indexes: block.indexes }));
}
