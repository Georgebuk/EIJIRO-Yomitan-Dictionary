const xlsx = require('xlsx');
const { Dictionary, TermEntry, DictionaryIndex } = require('yomichan-dict-builder');

async function populateEntry(dictionary, term, definition){
    const span = {tag: "span", content:[]}
    span.content.push(definition);
    const detailedDefinition = {
        type: 'structured-content',
        content: span,
      };
    let entry = new TermEntry(term)
    .setReading('')
    .addDetailedDefinition(detailedDefinition)
    .build();
    await dictionary.addTerm(entry);
}

/**
 * Builds a dictionary from an Excel file.
 * @param {string} relativePath - The path to the Excel file.
 * @param {Dictionary} dictionary - The path to the Excel file.
 * @returns {Promise<Dictionary>} - A promise that resolves to the created yomichan dictionary.
 */
async function populateFrequenciesFromFile(relativePath, dictionary) {
    const workbook = xlsx.readFile(relativePath);
    const uniqueTerms = new Set();
    
    for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert the worksheet to JSON
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        // Process rows (start at row 1 to skip any headers, if applicable)
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            let term = row[2] ? row[2] : ''; 



            // if (term) {
            //     //Add tag to dictionary based on sheet name
            //     //assumes sheet name = tag name
            //     await dictionary.addTermMeta([term, 'freq', sheetName]);
            // }
            // if(row[3] && !uniqueTerms.has(term)) {
            //     await populateEntry(dictionary, term, row[3].toString());
            //     uniqueTerms.add(term);
            // }
        }
    }
    return dictionary;
}

async function addMetaTags(dictionary) {
    dictionary.addTag({
        name: '英1',
        category: '英検',
        sortingOrder: -5,
        notes: 'おそらく英検1級レベルの単語です。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '英準1',
        category: '英検',
        sortingOrder: -5,
        notes: 'おそらく英検準1級レベルの単語です。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '英2',
        category: '英検',
        sortingOrder: -5,
        notes: 'おそらく英検2級レベルの単語です。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '英準2',
        category: '英検',
        sortingOrder: -5,
        notes: 'おそらく英検準2級レベルの単語です。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '英3',
        category: '英検',
        sortingOrder: -5,
        notes: 'おそらく英検3級レベルの単語です。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '英準4',
        category: '英検',
        sortingOrder: -5,
        notes: 'おそらく英検4級レベルの単語です。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '英5',
        category: '英検',
        sortingOrder: -5,
        notes: 'おそらく英検5級レベルの単語です。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '中',
        category: '学年',
        sortingOrder: -5,
        notes: '中学校で教わる単語です',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '高',
        category: '学年',
        sortingOrder: -5,
        notes: '公立高校の入試によく出題されます',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '共',
        category: '共通テスト',
        sortingOrder: -5,
        notes: '単語は共通テストに登場する可能性があります。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '受',
        category: '受験',
        sortingOrder: -5,
        notes: '一流大学の入試に単語が登場する可能性があります（旧帝大、早慶上智、関関同立）',
        popularityScore: 0,
      });
}

/**
 * Builds a dictionary from an Excel file.
 * @param {{Object.<string, string[]>}} wordsToTags - Dictinoary of words to their tags
 * @returns {Promise<Dictionary>} - A promise that resolves to the created yomitan dictionary.
 */
async function buildYomitanDictionary(wordsToTags){
    const dictionary = new Dictionary({
        fileName: "英単語レベル辞書.zip",
      });

       // Set index
    const index = new DictionaryIndex()
    .setTitle("英単語レベル辞書")
    .setRevision('1.0')
    .setAuthor('George')
    .setDescription("さまざまな英単語のレベルを、一般的な学習時期や、一般的にどのようなテストに出題されるかという観点から表示します。")
    .setAttribution('英語漬け')
    .setUrl('https://www.eigo-duke.com/')
    .build();
    await dictionary.setIndex(index);

    for (const [word, tags] of Object.entries(wordsToTags)) {

        let entry = new TermEntry(word)
        .setReading('')
        .addDetailedDefinition('')
        .setTermTags(tags['tags'])
        .build();
        await dictionary.addTerm(entry);
    }

    await addMetaTags(dictionary);
    return dictionary;
}

/**
 * Reads multiple Excel files and builds a dictionary.
 * @param {string[]} filePaths - Array of Excel file paths to process.
 * @returns {object} - Dictionary with words as keys and tags as space-separated values.
 */
function buildWordTagDictionary(filePaths) {
    const wordToTags = {};
    const uniqueTags = new Set(); 

    filePaths.forEach(filePath => {
        const workbook = xlsx.readFile(filePath);

        //Sheetname = tag for the word e.g　高（高校レベル単語）or 受験（大学の受験レベル単語）
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
            uniqueTags.add(sheetName);
            data.forEach(row => {
                const word = row[2]; 
                if (word) {
                    if (!wordToTags[word]) {
                        wordToTags[word] = {tags: sheetName, definition: row[3]};
                    } else if (!wordToTags[word]['tags'].includes(sheetName)) {
                        wordToTags[word]['tags'] += ` ${sheetName}`;
                    }
                }
            });
        });
    });

    console.log([...uniqueTags]);
    return wordToTags;
}

module.exports = {
    populateFrequenciesFromFile, 
    buildWordTagDictionary,
    buildYomitanDictionary
};