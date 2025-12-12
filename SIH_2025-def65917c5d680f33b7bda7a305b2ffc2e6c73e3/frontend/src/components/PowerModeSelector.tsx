"use client";

import { useState } from "react";
import { Card, Button } from "./UI";
import { Zap, Leaf, Gauge } from "lucide-react";
import { motorService } from "@/services/api";
import useStore from "@/store/useStore";
import { toast } from "sonner";

type PowerMode = "eco" | "normal" | "power";

interface ModeConfig {
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  motorASpeed: number;
  motorBSpeed: number;
  description: string;
}

const MODES: Record<PowerMode, ModeConfig> = {
  eco: {
    name: "Eco Mode",
    icon: <Leaf size={20} />,
    color: "text-green-400",
    bgColor: "bg-green-500/20 border-green-500",
    motorASpeed: 70,
    motorBSpeed: 70,
    description: "Energy efficient • Lower power consumption",
  },
  normal: {
    name: "Normal Mode",
    icon: <Gauge size={20} />,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20 border-blue-500",
    motorASpeed: 75,
    motorBSpeed: 75,
    description: "Balanced performance • Recommended",
  },
  power: {
    name: "Power Mode",
    icon: <Zap size={20} />,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20 border-yellow-500",
    motorASpeed: 85,
    motorBSpeed: 85,
    description: "Maximum performance • High speed",
  },
};

export const PowerModeSelector = () => {
  const [currentMode, setCurrentMode] = useState<PowerMode>("normal");
  const [isSwitching, setIsSwitching] = useState(false);
  const motorA = useStore((state) => state.motorA);
  const motorB = useStore((state) => state.motorB);
  const updateMotorA = useStore((state) => state.updateMotorA);
  const updateMotorB = useStore((state) => state.updateMotorB);
  const addLog = useStore((state) => state.addLog);

  const handleModeChange = async (mode: PowerMode) => {
    if (mode === currentMode || isSwitching) return;

    setIsSwitching(true);
    const config = MODES[mode];
    const bothMotorsOn = motorA.isOn && motorB.isOn;

    try {
      toast.info(`Switching to ${config.name}...`);

      // Step 1: Turn off motors if they're running
      if (bothMotorsOn) {
        addLog({
          motor: "System",
          event: "Mode Switch: Stopping motors",
          voltage: 0,
        });

        await Promise.all([motorService.stop("a"), motorService.stop("b")]);

        updateMotorA({ isOn: false, status: "stopped" });
        updateMotorB({ isOn: false, status: "stopped" });

        // Wait for motors to fully stop
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Step 2: Change speeds
      addLog({
        motor: "System",
        event: `Mode Switch: Setting speeds to ${config.motorASpeed}%`,
        voltage: 0,
      });

      await Promise.all([
        motorService.setSpeed("a", config.motorASpeed),
        motorService.setSpeed("b", config.motorBSpeed),
      ]);

      updateMotorA({ speed: config.motorASpeed });
      updateMotorB({ speed: config.motorBSpeed });

      // Wait for speed adjustment
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Step 3: Turn motors back on if they were running
      if (bothMotorsOn) {
        addLog({
          motor: "System",
          event: "Mode Switch: Restarting motors",
          voltage: 0,
        });

        await Promise.all([motorService.start("a"), motorService.start("b")]);

        updateMotorA({ isOn: true, status: "running" });
        updateMotorB({ isOn: true, status: "running" });
      }

      setCurrentMode(mode);
      toast.success(`${config.name} activated!`);

      addLog({
        motor: "System",
        event: `${config.name} activated`,
        voltage: 0,
      });
    } catch (error) {
      console.error("Failed to switch mode:", error);
      toast.error("Failed to switch mode");

      // Try to restore motors to running state if they were on
      if (bothMotorsOn) {
        try {
          await Promise.all([motorService.start("a"), motorService.start("b")]);
          updateMotorA({ isOn: true, status: "running" });
          updateMotorB({ isOn: true, status: "running" });
        } catch (restoreError) {
          console.error("Failed to restore motor state:", restoreError);
        }
      }
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-1">Power Mode</h3>
        <p className="text-sm text-gray-400">
          Select operating mode for both motors
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(MODES) as PowerMode[]).map((mode) => {
          const config = MODES[mode];
          const isActive = currentMode === mode;

          return (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              disabled={isSwitching}
              className={`
                relative p-4 rounded-lg border-2 transition-all duration-300
                ${
                  isActive
                    ? config.bgColor
                    : "bg-dark-700 border-dark-600 hover:border-dark-500"
                }
                ${
                  isSwitching
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }
                disabled:cursor-not-allowed
              `}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={config.color}>{config.icon}</div>
                <span className="font-semibold text-white">{config.name}</span>
                {isActive && (
                  <span className="ml-auto">
                    <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 text-left">
                {config.description}
              </p>
              <div className="mt-3 pt-3 border-t border-dark-600">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Motor A:</span>
                  <span className={isActive ? config.color : "text-gray-400"}>
                    {config.motorASpeed}%
                  </span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-500">Motor B:</span>
                  <span className={isActive ? config.color : "text-gray-400"}>
                    {config.motorBSpeed}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {isSwitching && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-neon">
            <div className="w-4 h-4 border-2 border-neon border-t-transparent rounded-full animate-spin" />
            <span>Switching mode...</span>
          </div>
        </div>
      )}
    </Card>
  );
};
