const { populateFrequenciesFromFile, buildWordTagDictionary, buildYomitanDictionary } = require('./frequencyBuilder');
const { Dictionary, DictionaryIndex } = require('yomichan-dict-builder');

async function prepareDictionary(filename, title, description){
    const dictionary = new Dictionary({
        fileName: filename,
      });

       // Set index
    const index = new DictionaryIndex()
    .setTitle(title)
    .setRevision('1.0')
    .setAuthor('George')
    .setDescription(description)
    .setAttribution('英語漬け')
    .setUrl('https://www.eigo-duke.com/')
    .build();
    await dictionary.setIndex(index);

    return dictionary;
}

async function buildDictionary(pathToFile, filename, title, description){
    const dictionary = await prepareDictionary(filename, 
        title, 
        description)

    await populateFrequenciesFromFile(pathToFile, dictionary);

    await dictionary.export('./test');
}

async function buildTagDictionary(wordsToTags){

}

(async () => {
    try {
        let filePaths = [];
        filePaths.push('potential dictionaries/英検頻度.xlsx');
        //filePaths.push('potential dictionaries/TOEIC.xlsx');
        filePaths.push('potential dictionaries/学年.xlsx');
        filePaths.push('potential dictionaries/共通テスト.xlsx')
        filePaths.push('potential dictionaries/大学受験.xlsx')

        const wordsToTags = buildWordTagDictionary(filePaths);
        const dictionary = await buildYomitanDictionary(wordsToTags);
    //     await buildDictionary('potential dictionaries/英検頻度.xlsx', 
    //         '英検頻度.zip', 
    //         '英検',
    //         'この単語は表示されている英検レベルに表示されている。同じ単語のさまざまな意味が、異なるレベルに表示されることがあります。'
    //     );
    //     await buildDictionary('potential dictionaries/TOEIC.xlsx', 
    //         'TOEIC頻度.zip',
    //         'TOEIC',
    //         'その単語がTOEICのどのレベルに相当するかを示します。'
    //     );
    //     await buildDictionary('potential dictionaries/学年.xlsx',
    //         '学年頻度.zip',
    //         '学年',
    //         'その単語がどの学校のレベルであるかを表示します。大学入試に出題される単語も含まれています。'
    //     )
        
        await dictionary.export('./test');
        console.log('Dictionary created successfully!');
    } catch (error) {
        console.error('Error:', error);
    }
})();