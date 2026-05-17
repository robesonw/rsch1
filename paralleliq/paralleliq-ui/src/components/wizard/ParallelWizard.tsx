/**
 * components/wizard/ParallelWizard.tsx
 *
 * 7-step wizard for creating a Production Parallel.
 *
 * IMPORTANT: Step 2 label and behaviour changes based on executionMode chosen in Step 1:
 *   REPLAY_VALIDATE → Step 2 = "Source binding" (capture from Env A)
 *   TRUE_PARALLEL   → Step 2 = "Injection config" (inject same data to both envs)
 *
 * The wizard collects data from each step and composes a CreateParallelRequest on submit.
 */
import React, { useState } from 'react';
import type {
  CreateParallelRequest,
  ExecutionMode,
  WizardStep1,
  WizardStep2Source,
  WizardStep3Transform,
  WizardStep4Target,
  WizardStep5OutputPull,
  WizardStep6Assertions,
  WizardStep7Schedule,
} from '../../types';

interface WizardState {
  step1?: WizardStep1;
  step2?: WizardStep2Source;
  step3?: WizardStep3Transform;
  step4?: WizardStep4Target;
  step5?: WizardStep5OutputPull;
  step6?: WizardStep6Assertions;
  step7?: WizardStep7Schedule;
}

interface ParallelWizardProps {
  projectId: string;
  onComplete: (request: CreateParallelRequest) => void;
  onCancel: () => void;
}

const STEPS_REPLAY = [
  'Name & project',
  'Source binding',
  'Transform rules',
  'Target binding',
  'Output pull',
  'Assertions',
  'Review & save',
];

const STEPS_TRUE_PARALLEL = [
  'Name & project',
  'Injection config',
  'Transform rules',
  'Env A capture',
  'Env B capture',
  'Reconciliation',
  'Review & save',
];

export const ParallelWizard: React.FC<ParallelWizardProps> = ({
  projectId,
  onComplete,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardState, setWizardState] = useState<WizardState>({});

  const executionMode: ExecutionMode =
    wizardState.step1?.executionMode ?? 'REPLAY_VALIDATE';

  const stepLabels =
    executionMode === 'TRUE_PARALLEL' ? STEPS_TRUE_PARALLEL : STEPS_REPLAY;

  const handleStep1 = (data: WizardStep1) => {
    setWizardState((s) => ({ ...s, step1: data }));
    setCurrentStep(2);
  };

  const handleStep2 = (data: WizardStep2Source) => {
    setWizardState((s) => ({ ...s, step2: data }));
    setCurrentStep(3);
  };

  const handleStep3 = (data: WizardStep3Transform) => {
    setWizardState((s) => ({ ...s, step3: data }));
    setCurrentStep(4);
  };

  const handleStep4 = (data: WizardStep4Target) => {
    setWizardState((s) => ({ ...s, step4: data }));
    setCurrentStep(5);
  };

  const handleStep5 = (data: WizardStep5OutputPull) => {
    setWizardState((s) => ({ ...s, step5: data }));
    setCurrentStep(6);
  };

  const handleStep6 = (data: WizardStep6Assertions) => {
    setWizardState((s) => ({ ...s, step6: data }));
    setCurrentStep(7);
  };

  const handleSubmit = (scheduleData: WizardStep7Schedule) => {
    if (!wizardState.step1 || !wizardState.step2 || !wizardState.step4) return;

    const request: CreateParallelRequest = {
      name: wizardState.step1.name,
      projectId,
      description: wizardState.step1.description,
      executionMode: wizardState.step1.executionMode,
      sourceBinding: {
        environmentId: wizardState.step2.environmentId,
        protocol: wizardState.step2.protocol,
        endpoint: wizardState.step2.endpoint,
        filter: wizardState.step2.filter,
        captureMode: wizardState.step2.captureMode,
        durationSeconds: wizardState.step2.durationSeconds,
        maxMessages: wizardState.step2.maxMessages,
        correlationKey: wizardState.step2.correlationKey,
      },
      ruleSetId: wizardState.step3?.ruleSetId,
      ruleSetVersion: wizardState.step3?.ruleSetVersion,
      inlineOverrides: wizardState.step3?.inlineOverrides,
      targetBinding: {
        environmentId: wizardState.step4.environmentId,
        protocol: wizardState.step4.protocol,
        endpoint: wizardState.step4.endpoint,
        ratePerSecond: wizardState.step4.ratePerSecond,
        preserveOrder: wizardState.step4.preserveOrder,
      },
      outputPullConfig: wizardState.step5?.outputPullConfig,
      assertionSetId: wizardState.step6?.assertionSetId,
      scheduleCron: scheduleData.scheduleCron,
    };

    onComplete(request);
  };

  return (
    <div className="flex gap-6 items-start">
      {/* Step indicator */}
      <div className="w-44 flex-shrink-0">
        {stepLabels.map((label, idx) => {
          const stepNum = idx + 1;
          const isDone = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          return (
            <div key={stepNum} className="flex items-start gap-2 mb-5">
              <div className="flex flex-col items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0
                    ${isDone ? 'bg-green-500 text-white' : ''}
                    ${isCurrent ? 'bg-indigo-500 text-white' : ''}
                    ${!isDone && !isCurrent ? 'bg-gray-700 text-gray-400 border border-gray-600' : ''}
                  `}
                >
                  {isDone ? '✓' : stepNum}
                </div>
                {stepNum < stepLabels.length && (
                  <div className="w-px h-5 bg-gray-700 mt-1" />
                )}
              </div>
              <span
                className={`text-xs pt-0.5 leading-tight
                  ${isDone ? 'text-green-400' : ''}
                  ${isCurrent ? 'text-white font-medium' : ''}
                  ${!isDone && !isCurrent ? 'text-gray-500' : ''}
                `}
              >
                {label}
              </span>
            </div>
          );
        })}

        {/* Execution mode badge */}
        {wizardState.step1 && (
          <div className="mt-4 px-2 py-1.5 rounded bg-gray-800 border border-gray-700">
            <p className="text-xs text-gray-500 mb-0.5">Mode</p>
            <p className={`text-xs font-medium ${
              executionMode === 'TRUE_PARALLEL' ? 'text-blue-400' : 'text-indigo-400'
            }`}>
              {executionMode === 'TRUE_PARALLEL' ? 'True Parallel' : 'Replay & Validate'}
            </p>
          </div>
        )}
      </div>

      {/* Step panel */}
      <div className="flex-1 bg-gray-900 border border-gray-700 rounded-xl p-6">
        {/* TODO: Render the correct step component based on currentStep */}
        {/* Step components are in components/wizard/steps/ */}
        {/* Each step receives onNext(data) and onBack() */}
        <p className="text-gray-400 text-sm">
          Step {currentStep} of {stepLabels.length} — {stepLabels[currentStep - 1]}
        </p>
        <p className="text-gray-600 text-xs mt-2">
          Implement step components in <code>components/wizard/steps/</code>
        </p>
      </div>
    </div>
  );
};

export default ParallelWizard;
