import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

interface CustomLessonDialogProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: "success" | "warning" | "error" | "info";
}

export const CustomLessonDialog: React.FC<CustomLessonDialogProps> = ({
  visible,
  title,
  message,
  icon,
  onClose,
  onConfirm,
  confirmText = "OK",
  cancelText = "Cancel",
  type = "info",
}) => {
  const { currentTheme } = useTheme();
  const theme = currentTheme.colors;

  const getIconForType = () => {
    if (icon) return icon;

    switch (type) {
      case "success":
        return "🎉";
      case "warning":
        return "⚠️";
      case "error":
        return "❌";
      default:
        return "ℹ️";
    }
  };

  const getColorForType = () => {
    switch (type) {
      case "success":
        return "#4CAF50";
      case "warning":
        return "#FF9800";
      case "error":
        return "#F44336";
      default:
        return theme.primary;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialogContainer}>
          <View style={[styles.dialog, { backgroundColor: theme.surface }]}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{getIconForType()}</Text>
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

            {/* Message */}
            <Text style={[styles.message, { color: theme.textSecondary }]}>
              {message}
            </Text>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {onConfirm ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.cancelButton,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={onClose}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {cancelText}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.confirmButton,
                      { backgroundColor: getColorForType() },
                    ]}
                    onPress={onConfirm}
                  >
                    <Text style={styles.confirmButtonText}>{confirmText}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.singleButton,
                    { backgroundColor: getColorForType() },
                  ]}
                  onPress={onClose}
                >
                  <Text style={styles.confirmButtonText}>{confirmText}</Text>
                </TouchableOpacity>
              )}
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialogContainer: {
    width: "100%",
    maxWidth: 320,
  },
  dialog: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  iconContainer: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
    textAlign: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  singleButton: {
    flex: 1,
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    color: "#fff",
  },
});

export default CustomLessonDialog;
