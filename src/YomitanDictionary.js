const { Dictionary, DictionaryIndex, TermEntry } = require('yomichan-dict-builder');

class YomitanDictionary{
    constructor(fileName) {
        this.dictionary = new Dictionary({
            fileName: fileName,
          });
        this.exportDir = "./output";
      }

    /**
     * Adds index file to dictionary
     * @param {string} title - Title of the dictionary
     * @param {string} description - Description that will appear in Yomitan when dictionary is clicked.
     * @param {string} attribution - Who is the data attributed.
     * @param {string} sourceURL - Link to source of data
     * @returns {import('yomichan-dict-builder/dist/types/yomitan/dictionaryindex').DictionaryIndexType} - Yomitan dictionary index.
     */
    setIndex(title, description, attribution, sourceURL){
        const index = new DictionaryIndex()
        .setTitle(title)
        .setRevision('1.0')
        .setAuthor('George')
        .setDescription(description)
        .setAttribution(attribution)
        .setUrl(sourceURL)
        .build();
        
        this.dictionary.setIndex(index);
    }

    addEntry(term, reading, content, entryTag, termTags){
      let entry = new TermEntry(term)
              .setReading(reading)
              .addDetailedDefinition(content)
              .setDefinitionTags(entryTag)
              .setTermTags(termTags)
              .build();
      this.dictionary.addTerm(entry);
    }

    addTag(name, category, sortingOrder, description, popularityScore){
      this.dictionary.addTag({
        name: name,
        category: category,
        sortingOrder: sortingOrder,
        notes: description,
        popularityScore: popularityScore,
      });
    }

    addMetaTag(term, freq){
      this.dictionary.addTermMeta([term, 'freq', freq]);
    }

    export(){
      this.dictionary.export(this.exportDir);
  }
}



module.exports = YomitanDictionary;