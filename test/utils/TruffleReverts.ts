import {AssertionError} from 'assert';
//const isEqual = require('lodash.isequal');

export module truffleAssert {
/* Creates a new assertion message, containing the passedAssertionMessage and
 * the defaultAssertion message when passedAssertionMessage exists, otherwise
 * just the default.
 */
const createAssertionMessage = (passedMessage, defaultMessage) => {
    let assertionMessage = defaultMessage;
    if (passedMessage) {
      assertionMessage = `${passedMessage} : ${defaultMessage}`;
    }
    return assertionMessage;
  };

const ErrorType = {
  REVERT: 'revert',
  INVALID_OPCODE: 'invalid opcode',
  OUT_OF_GAS: 'out of gas',
  INVALID_JUMP: 'invalid JUMP',
};
  
const fails = async (asyncFn, errorType, reason, message) => {
    try {
      await asyncFn;
    } catch (error) {
      if (errorType && !error.message.includes(errorType)) {
        const assertionMessage = createAssertionMessage(message??reason, `Expected to fail with ${errorType}, but failed with: ${error}`);
        throw new AssertionError(assertionMessage);
      } else if (reason && !error.reason.includes(reason)) {
        const assertionMessage = createAssertionMessage(message??reason, `Expected to fail with ${reason}, but failed with: ${error}`);
        throw new AssertionError(assertionMessage);
      }
      // Error was handled by errorType or reason
      return;
    }
    const assertionMessage = createAssertionMessage(message??reason, 'Did not fail');
    throw new AssertionError(assertionMessage);
  };

export const reverts = async (asyncFn, reason, message = null) => (
  fails(asyncFn, ErrorType.REVERT, reason, message)
  );
}
