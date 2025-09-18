import { useTranslation } from 'react-i18next';

export function VoiceCommandHelp() {
  const { t } = useTranslation();
  
  const commands = [
    {
      command: t('voice-commands.show-conflicts', { region: 'North Zone' }),
      description: 'Show conflicts in a specific region'
    },
    {
      command: t('voice-commands.train-status', { trainId: '12345' }),
      description: 'Get status of a specific train'
    },
    {
      command: t('voice-commands.energy-report'),
      description: 'Generate energy efficiency report'
    },
    {
      command: t('voice-commands.run-scenario', { scenario: 'fog' }),
      description: 'Run a scenario simulation'
    },
    {
      command: t('voice-commands.optimize-route', { trainId: '12345' }),
      description: 'Optimize route for a train'
    }
  ];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-neutral-300">Voice Commands</h3>
      <div className="space-y-1">
        {commands.map((cmd, index) => (
          <div key={index} className="text-xs">
            <div className="text-cyan-400 font-mono">&quot;{cmd.command}&quot;</div>
            <div className="text-neutral-500">{cmd.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

