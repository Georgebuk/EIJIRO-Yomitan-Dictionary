module.exports = {
    combineWithSpace:function(...strings) {
        return strings.filter(Boolean).join(' ');
    }
}
