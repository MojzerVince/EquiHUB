import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CustomDialog, DialogButton, createDialog } from '@/components/CustomDialog';

interface DialogConfig {
  title: string;
  message: string;
  buttons: DialogButton[];
}

interface DialogContextType {
  showDialog: (config: DialogConfig) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showConfirm: (title: string, message: string, onConfirm?: () => void, onCancel?: () => void) => void;
  showDelete: (itemName: string, onConfirm?: () => void, onCancel?: () => void) => void;
  showLogout: (onConfirm?: () => void, onCancel?: () => void) => void;
  hideDialog: () => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

interface DialogProviderProps {
  children: ReactNode;
}

export const DialogProvider: React.FC<DialogProviderProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<DialogConfig>({
    title: '',
    message: '',
    buttons: [],
  });

  const showDialog = (dialogConfig: DialogConfig) => {
    setConfig(dialogConfig);
    setVisible(true);
  };

  const hideDialog = () => {
    setVisible(false);
  };

  const showError = (message: string) => {
    const dialogConfig = createDialog.error(message);
    showDialog({
      title: dialogConfig.title,
      message: dialogConfig.message,
      buttons: dialogConfig.buttons,
    });
  };

  const showSuccess = (message: string) => {
    const dialogConfig = createDialog.success(message);
    showDialog({
      title: dialogConfig.title,
      message: dialogConfig.message,
      buttons: dialogConfig.buttons,
    });
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    const dialogConfig = createDialog.confirm(title, message, onConfirm, onCancel);
    showDialog({
      title: dialogConfig.title,
      message: dialogConfig.message,
      buttons: dialogConfig.buttons,
    });
  };

  const showDelete = (
    itemName: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    const dialogConfig = createDialog.delete(itemName, onConfirm, onCancel);
    showDialog({
      title: dialogConfig.title,
      message: dialogConfig.message,
      buttons: dialogConfig.buttons,
    });
  };

  const showLogout = (onConfirm?: () => void, onCancel?: () => void) => {
    const dialogConfig = createDialog.logout(onConfirm, onCancel);
    showDialog({
      title: dialogConfig.title,
      message: dialogConfig.message,
      buttons: dialogConfig.buttons,
    });
  };

  return (
    <DialogContext.Provider
      value={{
        showDialog,
        showError,
        showSuccess,
        showConfirm,
        showDelete,
        showLogout,
        hideDialog,
      }}
    >
      {children}
      <CustomDialog
        visible={visible}
        title={config.title}
        message={config.message}
        buttons={config.buttons}
        onClose={hideDialog}
      />
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextType => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

export default DialogProvider;
