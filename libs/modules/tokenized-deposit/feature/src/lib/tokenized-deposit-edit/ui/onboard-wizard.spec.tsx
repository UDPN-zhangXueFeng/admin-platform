import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import * as mockReact from 'react';

const React = mockReact;

jest.mock('@myorg/shared/ui', () => ({
  Button: ({ children, ...props }: mockReact.ComponentProps<'button'>) =>
    mockReact.createElement('button', props, children),
}));

import { WizardFooter } from './onboard-wizard';

describe('WizardFooter', () => {
  it('does not submit while advancing from custody to review', () => {
    const onSubmit = jest.fn();

    function FooterHarness(): React.JSX.Element {
      const [isLastStep, setIsLastStep] = React.useState(false);

      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <WizardFooter
            resetLabel="Reset"
            backLabel="Back"
            continueLabel="Continue"
            submitLabel="Submit"
            isFirstStep={false}
            isLastStep={isLastStep}
            onReset={jest.fn()}
            onBack={jest.fn()}
            onContinue={() => setIsLastStep(true)}
          />
        </form>
      );
    }

    render(<FooterHarness />);

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(continueButton);

    expect(onSubmit).not.toHaveBeenCalled();
    const submitButton = screen.getByRole('button', { name: 'Submit' });
    expect(submitButton).not.toBe(continueButton);

    fireEvent.click(submitButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
