export const normalizeTimeEntryLabel = (name: string) => name.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu, "");
