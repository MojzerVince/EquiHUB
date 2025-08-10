import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

const { width: screenWidth } = Dimensions.get("window");

export type DialogButton = {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

interface CustomDialogProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: DialogButton[];
  onClose?: () => void;
}

export const CustomDialog: React.FC<CustomDialogProps> = ({
  visible,
  title,
  message,
  buttons,
  onClose,
}) => {
  const { currentTheme } = useTheme();

  const handleButtonPress = (button: DialogButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onClose) {
      onClose();
    }
  };

  const getButtonStyle = (buttonStyle: string) => {
    switch (buttonStyle) {
      case "destructive":
        return {
          backgroundColor: currentTheme.colors.error,
          color: "#FFFFFF",
        };
      case "cancel":
        return {
          backgroundColor: currentTheme.colors.textSecondary,
          color: "#FFFFFF",
        };
      default:
        return {
          backgroundColor: currentTheme.colors.primary,
          color: "#FFFFFF",
        };
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View
            style={[
              styles.dialog,
              { backgroundColor: currentTheme.colors.surface },
            ]}
          >
            {/* Header */}
            <View
              style={[
                styles.header,
                { backgroundColor: currentTheme.colors.primary },
              ]}
            >
              <Text style={styles.title}>{title}</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text
                style={[styles.message, { color: currentTheme.colors.text }]}
              >
                {message}
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {buttons.map((button, index) => {
                const buttonStyle = getButtonStyle(button.style || "default");
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      { backgroundColor: buttonStyle.backgroundColor },
                      buttons.length === 1 && styles.singleButton,
                    ]}
                    onPress={() => handleButtonPress(button)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.buttonText, { color: buttonStyle.color }]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: screenWidth * 0.85,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  dialog: {
    borderRadius: 20,
    overflow: "hidden",
    minHeight: 180,
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inder",
    textAlign: "center",
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    minHeight: 60,
    justifyContent: "center",
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    fontFamily: "Inder",
  },
  buttonContainer: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  singleButton: {
    marginHorizontal: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    textAlign: "center",
  },
});

// Helper function to create common dialog configurations
export const createDialog = {
  error: (message: string, onClose?: () => void): CustomDialogProps => ({
    visible: true,
    title: "Error",
    message,
    buttons: [{ text: "OK", style: "default" }],
    onClose,
  }),

  success: (message: string, onClose?: () => void): CustomDialogProps => ({
    visible: true,
    title: "Success",
    message,
    buttons: [{ text: "OK", style: "default" }],
    onClose,
  }),

  confirm: (
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ): CustomDialogProps => ({
    visible: true,
    title,
    message,
    buttons: [
      { text: "Cancel", style: "cancel", onPress: onCancel },
      { text: "Confirm", style: "default", onPress: onConfirm },
    ],
  }),

  delete: (
    itemName: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ): CustomDialogProps => ({
    visible: true,
    title: "Delete Item",
    message: `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
    buttons: [
      { text: "Cancel", style: "cancel", onPress: onCancel },
      { text: "Delete", style: "destructive", onPress: onConfirm },
    ],
  }),

  logout: (
    onConfirm?: () => void,
    onCancel?: () => void
  ): CustomDialogProps => ({
    visible: true,
    title: "Sign Out",
    message: "Are you sure you want to sign out?",
    buttons: [
      { text: "Cancel", style: "cancel", onPress: onCancel },
      { text: "Sign Out", style: "destructive", onPress: onConfirm },
    ],
  }),
};

export default CustomDialog;
