import 'babel-polyfill';
import { onMessage, Type, Target } from '../helpers/messaging';

chrome.runtime.getBackgroundPage(({ app }) => {
  const {
    util: {
      bypasslist,
      i18n: { t },
    },
    logger: { debug },
  } = app;

  const Element = {
    input: {
      id: 'import-file-input',
    },
    error: {
      id: 'import-error',
    },
    label: {
      id: 'import-file-label',
      key: 'ImportLabel',
    },
    message: {
      id: 'import-message',
      key: 'ImportFileMessage',
    },
  };

  function getCurrentTabID() {
    return new Promise((resolve) => {
      chrome.tabs.getCurrent(({ id: tabID }) => {
        resolve(tabID);
      });
    });
  }

  async function closeWindow() {
    const tabID = await getCurrentTabID();

    return new Promise((resolve) => {
      chrome.tabs.remove(tabID, (...args) => {
        resolve(...args);
      });
    });
  }

  /**
   * Set error message
   *
   * **DO NOT CALL WITH ANY USER INPUT**
   *
   * @param {string} msg Error message
   *
   * @returns {void}
   */
  function setError(msg) {
    debug(`importrules.js: ${msg}`);
    const errElement = document.getElementById(Element.error.id);
    errElement.innerHTML = msg;

    return new Error(`importrules.js: ${msg}`);
  }

  /**
   * Set error for invalid file
   */
  function setInvalidFileError() {
    setError(t('InvalidImportFileStructure'));
  }

  /**
   * Clear the error message
   */
  function clearError() {
    setError('');
  }

  /**
   * Attempt to parse the JSON file
   *
   * Sets error message if parsing fails
   */
  function parse(result) {
    let rules = null;
    try {
      rules = JSON.parse(result);
    }
    catch (_) {
      throw setInvalidFileError();
    }

    const { popularRules, userRules } = rules;
    if (!Array.isArray(popularRules) || !Array.isArray(userRules)) {
      throw setInvalidFileError();
    }

    const allRules = [...popularRules, ...userRules];
    allRules.forEach((rule) => {
      if (typeof rule !== 'string') {
        throw setInvalidFileError();
      }
    });

    clearError();

    return rules;
  }

  /**
   * Called when the imported file has been read successfully
   *
   * @returns {void}
   */
  function loadEndListener() {
    const { result } = this;
    let rules;
    try {
      rules = parse(result);
    }
    catch (err) {
      debug('importrules.js: failed to parse rules file, ensure valid JSON');
      return;
    }
    bypasslist.importRules(rules);
    closeWindow();
  }

  /**
   * Listen for file to be uploaded
   *
   * @returns {void}
   */
  function onFileChange() {
    const [file] = this.files;
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('loadend', loadEndListener);
      reader.readAsText(file);
    }
  }

  /**
   * Handle clicking of file input
   *
   * Clear current files and re-register the onfilechange listener
   *
   * @this {HTMLInputElement}
   */
  function onImportClick() {
    this.removeEventListener('change', onFileChange);
    this.value = null;
    this.addEventListener('change', onFileChange);
  }

  function updateTranslation({ id, key }) {
    document.getElementById(id).innerHTML = t(key);
  }

  onMessage(
    {
      target: Target.POPUPS,
      type: Type.FOREGROUND_OPEN,
    },
    closeWindow,
  );
  updateTranslation(Element.message);
  updateTranslation(Element.label);

  document.getElementById(Element.input.id).addEventListener('click', onImportClick);
});
