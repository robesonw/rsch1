/**
 * components/wizard/steps/SourceBindingStep.tsx
 *
 * Step 2 of 7 (REPLAY_VALIDATE mode) — Source binding.
 * Defines what to capture from Env A.
 *
 * For TRUE_PARALLEL mode this step is replaced by InjectionConfigStep.
 * The wizard shell renders the correct component based on executionMode.
 */
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { environmentService } from '../../../services/paralleliqService';
import type { WizardStep2Source } from '../../../types';

const schema = z.object({
  environmentId: z.string().uuid('Select an environment'),
  protocol: z.enum(['IBM_MQ', 'KAFKA', 'SOLACE', 'SFTP', 'FILE', 'DATABASE']),
  endpoint: z.string().min(1, 'Queue / topic / path is required'),
  filter: z.string().optional(),
  captureMode: z.enum(['SNAPSHOT_DURATION', 'SNAPSHOT_COUNT', 'CONTINUOUS']),
  durationSeconds: z.number().positive().optional(),
  maxMessages: z.number().positive().optional(),
  correlationKey: z.string().min(1, 'Correlation key is required'),
});

interface SourceBindingStepProps {
  initialValues?: WizardStep2Source;
  onNext: (data: WizardStep2Source) => void;
  onBack: () => void;
}

export const SourceBindingStep: React.FC<SourceBindingStepProps> = ({
  initialValues,
  onNext,
  onBack,
}) => {
  const { data: envResponse } = useQuery({
    queryKey: ['environments'],
    queryFn: () => environmentService.list().then((r) => r.data.data ?? []),
  });

  const { register, handleSubmit, watch, formState: { errors } } = useForm<WizardStep2Source>({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? {
      captureMode: 'SNAPSHOT_DURATION',
      durationSeconds: 300,
      correlationKey: 'JMSCorrelationID',
    },
  });

  const captureMode = watch('captureMode');
  const protocol = watch('protocol');

  const correlationKeyOptions: Record<string, string[]> = {
    IBM_MQ:   ['JMSCorrelationID', 'JMSMessageID', 'Custom header'],
    KAFKA:    ['Kafka record key', 'Header field', 'Payload field'],
    SOLACE:   ['Application message ID', 'User property', 'Payload field'],
    SFTP:     ['Filename', 'Payload field'],
    FILE:     ['Row number', 'Payload field'],
    DATABASE: ['Primary key column', 'Column value'],
  };

  return (
    <form onSubmit={handleSubmit(onNext)}>
      <h2 className="text-sm font-semibold text-white mb-1">Source binding</h2>
      <p className="text-xs text-gray-500 mb-5">
        Define what to capture from Env A. Environments are pre-configured by your admin.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Environment */}
        <div>
          <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5">
            ENVIRONMENT (Env A)
          </label>
          <select
            {...register('environmentId')}
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-white text-sm focus:border-indigo-500 outline-none"
          >
            <option value="">Select environment…</option>
            {envResponse?.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
          {errors.environmentId && (
            <p className="text-red-400 text-xs mt-1">{errors.environmentId.message}</p>
          )}
        </div>

        {/* Protocol */}
        <div>
          <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5">
            PROTOCOL
          </label>
          <select
            {...register('protocol')}
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-white text-sm focus:border-indigo-500 outline-none"
          >
            <option value="">Select protocol…</option>
            <option value="IBM_MQ">IBM MQ</option>
            <option value="KAFKA">Apache Kafka</option>
            <option value="SOLACE">Solace PubSub+</option>
            <option value="SFTP">SFTP / File</option>
            <option value="FILE">Local File</option>
            <option value="DATABASE">Database</option>
          </select>
          {errors.protocol && (
            <p className="text-red-400 text-xs mt-1">{errors.protocol.message}</p>
          )}
        </div>
      </div>

      {/* Endpoint */}
      <div className="mb-4">
        <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5">
          {protocol === 'KAFKA' ? 'TOPIC' : protocol === 'DATABASE' ? 'TABLE / QUERY' : 'QUEUE / PATH'}
        </label>
        <input
          {...register('endpoint')}
          className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-white text-sm focus:border-indigo-500 outline-none"
          placeholder={
            protocol === 'KAFKA' ? 'e.g. policy.events.production'
            : protocol === 'IBM_MQ' ? 'e.g. POLICY.REQUEST.QUEUE'
            : protocol === 'DATABASE' ? 'e.g. dbo.policy_events'
            : 'e.g. /data/input/'
          }
        />
        {errors.endpoint && (
          <p className="text-red-400 text-xs mt-1">{errors.endpoint.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Capture mode */}
        <div>
          <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5">
            CAPTURE MODE
          </label>
          <select
            {...register('captureMode')}
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-white text-sm focus:border-indigo-500 outline-none"
          >
            <option value="SNAPSHOT_DURATION">Snapshot — duration</option>
            <option value="SNAPSHOT_COUNT">Snapshot — message count</option>
            <option value="CONTINUOUS">Continuous</option>
          </select>
        </div>

        {/* Duration / count */}
        {captureMode === 'SNAPSHOT_DURATION' && (
          <div>
            <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5">
              DURATION (seconds)
            </label>
            <input
              {...register('durationSeconds', { valueAsNumber: true })}
              type="number"
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>
        )}
        {captureMode === 'SNAPSHOT_COUNT' && (
          <div>
            <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5">
              MAX MESSAGES
            </label>
            <input
              {...register('maxMessages', { valueAsNumber: true })}
              type="number"
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="mb-4">
        <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5">
          FILTER EXPRESSION (optional)
        </label>
        <input
          {...register('filter')}
          className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-white text-sm focus:border-indigo-500 outline-none"
          placeholder={
            protocol === 'IBM_MQ' ? "e.g. JMSType = 'POLICY' — leave blank for all"
            : "Leave blank to capture all"
          }
        />
      </div>

      {/* Correlation key */}
      <div className="mb-5">
        <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5">
          CORRELATION KEY
        </label>
        <select
          {...register('correlationKey')}
          className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-white text-sm focus:border-indigo-500 outline-none"
        >
          {(correlationKeyOptions[protocol] ?? ['Payload field']).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-between pt-4 border-t border-gray-800">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 border border-gray-700 text-gray-400 rounded-md text-sm hover:bg-gray-800 transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">2 / 7</span>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-500 transition-colors"
          >
            Next: Transform rules →
          </button>
        </div>
      </div>
    </form>
  );
};

export default SourceBindingStep;
