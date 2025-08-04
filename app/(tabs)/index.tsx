import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function AlertStuff(text: any, text2: any) {
  Alert.alert(text, text2);
}

// Dropdown options
const genderOptions = [
  "Stallion",
  "Mare", 
  "Gelding",
  "Filly",
  "Colt"
];

const breedOptions = [
  "Arabian",
  "Thoroughbred",
  "Quarter Horse",
  "Paint Horse", 
  "Appaloosa",
  "Friesian",
  "Clydesdale",
  "Percheron",
  "Belgian",
  "Shire",
  "Mustang",
  "Morgan",
  "Tennessee Walker",
  "Standardbred",
  "Andalusian",
  "Hanoverian",
  "Warmblood",
  "Lipicai",
  "Magyar Sportló",
  "Shagya Araber",
  "Gidran",
  "Nonius",
  "Furioso-North Star",
  "Shitlandi póni",
  "Shetland Pony",
  "Welsh Pony",
  "Haflinger",
  "Icelandic Horse",
  "Fjord",
  "Akhal-Teke",
  "Barb",
  "Lusitano",
  "Paso Fino",
  "Criollo",
  "Mangalarga",
  "Camargue",
  "Connemara",
  "Dartmoor",
  "Exmoor",
  "New Forest",
  "Fell Pony",
  "Dales Pony",
  "Highland Pony",
  "Eriskay Pony",
  "Przewalski's Horse",
  "Døle Gudbrandsdal",
  "Nordlandshest",
  "Finnhorse",
  "Gotland Pony",
  "Östermalm",
  "Žemaitukas",
  "Estonian Native",
  "Latvian",
  "Trakehner",
  "Oldenburg",
  "Holstein",
  "Württemberger",
  "Bavarian Warmblood",
  "Rheinland-Pfalz-Saar",
  "Brandenburger",
  "Mecklenburg",
  "Sachsen-Anhaltiner",
  "Thüringer",
  "Other"
];

const MyHorsesScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [horses, setHorses] = useState(data);
  
  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingHorse, setEditingHorse] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editHeight, setEditHeight] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editBirthDate, setEditBirthDate] = useState<Date | null>(null);

  // Dropdown state
  const [genderDropdownVisible, setGenderDropdownVisible] = useState(false);
  const [breedDropdownVisible, setBreedDropdownVisible] = useState(false);
  
  // Number picker state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [heightPickerVisible, setHeightPickerVisible] = useState(false);
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  // Image picker state
  const [editImage, setEditImage] = useState<any>(null);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const openEditModal = (horse: any) => {
    setEditingHorse(horse);
    setEditName(horse.name);
    setEditGender(horse.gender);
    setEditYear(horse.year.toString());
    setEditHeight(horse.height.toString());
    setEditBreed(horse.breed);
    setEditImage(horse.img);
    
    // Set birth date from year (assume January 1st if only year is available)
    if (horse.birthDate) {
      setEditBirthDate(new Date(horse.birthDate));
    } else if (horse.year) {
      setEditBirthDate(new Date(horse.year, 0, 1)); // January 1st of the year
    } else {
      setEditBirthDate(null);
    }
    
    setGenderDropdownVisible(false);
    setBreedDropdownVisible(false);
    setDatePickerVisible(false);
    setHeightPickerVisible(false);
    setShowImagePickerModal(false);
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingHorse(null);
    setEditName("");
    setEditGender("");
    setEditYear("");
    setEditHeight("");
    setEditBreed("");
    setEditImage(null);
    setEditBirthDate(null);
    setGenderDropdownVisible(false);
    setBreedDropdownVisible(false);
    setDatePickerVisible(false);
    setHeightPickerVisible(false);
    setShowImagePickerModal(false);
  };

  const saveHorseEdit = () => {
    // Normalize and trim input values to handle UTF-8 properly
    const normalizedName = editName.normalize('NFC').trim();
    const normalizedGender = editGender.normalize('NFC').trim();
    const normalizedBreed = editBreed.normalize('NFC').trim();
    const normalizedHeight = editHeight.trim();

    if (!normalizedName || !normalizedGender || !editBirthDate || !normalizedHeight || !normalizedBreed) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    // Validate name contains only valid characters (letters, spaces, hyphens, apostrophes, and UTF-8 characters)
    const namePattern = /^[\p{L}\p{M}\s\-'\.]+$/u;
    if (!namePattern.test(normalizedName)) {
      Alert.alert("Error", "Horse name contains invalid characters");
      return;
    }

    // Validate name length
    if (normalizedName.length < 2 || normalizedName.length > 50) {
      Alert.alert("Error", "Horse name must be between 2 and 50 characters");
      return;
    }

    // Validate birth date
    const currentDate = new Date();
    const minDate = new Date(1980, 0, 1);
    if (editBirthDate < minDate || editBirthDate > currentDate) {
      Alert.alert("Error", "Please enter a valid birth date");
      return;
    }

    const heightNum = parseInt(normalizedHeight);

    if (isNaN(heightNum) || heightNum < 50 || heightNum > 250) {
      Alert.alert("Error", "Please enter a valid height (50-250 cm)");
      return;
    }

    const updatedHorses = horses.map(horse => 
      horse.id === editingHorse.id 
        ? {
            ...horse,
            name: normalizedName,
            gender: normalizedGender,
            year: editBirthDate.getFullYear(),
            birthDate: editBirthDate.toISOString(),
            height: heightNum,
            breed: normalizedBreed,
            img: editImage || horse.img
          }
        : horse
    );

    setHorses(updatedHorses);
    closeEditModal();
    setSuccessMessage(`${normalizedName} has been updated!`);
    setShowSuccessModal(true);
  };

  // Image picker functions
  const pickImageFromLibrary = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Permission to access camera roll is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setEditImage({ uri: result.assets[0].uri });
      setShowImagePickerModal(false);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Permission to access camera is required!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setEditImage({ uri: result.assets[0].uri });
      setShowImagePickerModal(false);
    }
  };

  // Custom Dropdown Component
  const CustomDropdown = ({ 
    value, 
    placeholder, 
    options, 
    onSelect, 
    isVisible, 
    setVisible 
  }: {
    value: string;
    placeholder: string;
    options: string[];
    onSelect: (option: string) => void;
    isVisible: boolean;
    setVisible: (visible: boolean) => void;
  }) => {
    return (
      <View style={{ marginBottom: 20 }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#2D5A66',
            borderRadius: 8,
            paddingVertical: 15,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: '#4A9BB7',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          onPress={() => setVisible(!isVisible)}
        >
          <Text style={{
            color: value ? '#FFFFFF' : '#B0B0B0',
            fontSize: 16,
            fontFamily: "Inder",
            includeFontPadding: false,
          }}>
            {value || placeholder}
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 16 }}>
            {isVisible ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        
        {isVisible && (
          <Modal
            transparent={true}
            visible={isVisible}
            animationType="fade"
            onRequestClose={() => setVisible(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => setVisible(false)}
            >
              <View style={{
                backgroundColor: '#1C3A42',
                borderRadius: 12,
                padding: 20,
                maxHeight: 300,
                width: '80%',
                borderWidth: 1,
                borderColor: '#4A9BB7',
              }}>
                <ScrollView style={{ maxHeight: 250 }}>
                  {options.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={{
                        paddingVertical: 15,
                        paddingHorizontal: 10,
                        borderBottomWidth: index < options.length - 1 ? 1 : 0,
                        borderBottomColor: '#335C67',
                      }}
                      onPress={() => {
                        onSelect(option);
                        setVisible(false);
                      }}
                    >
                      <Text style={{
                        color: value === option ? '#4A9BB7' : '#FFFFFF',
                        fontSize: 16,
                        fontWeight: value === option ? 'bold' : 'normal',
                        fontFamily: "Inder",
                        textAlign: "left",
                        includeFontPadding: false,
                      }}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </View>
    );
  };

  // Custom Date Picker Component
  const DatePicker = ({
    value,
    placeholder,
    onSelect,
    isVisible,
    setVisible
  }: {
    value: Date | null;
    placeholder: string;
    onSelect: (date: Date) => void;
    isVisible: boolean;
    setVisible: (visible: boolean) => void;
  }) => {
    const [selectedDay, setSelectedDay] = useState(value?.getDate() || 1);
    const [selectedMonth, setSelectedMonth] = useState(value?.getMonth() || 0);
    const [selectedYear, setSelectedYear] = useState(value?.getFullYear() || new Date().getFullYear());

    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const generateYears = () => {
      const years = [];
      const currentYear = new Date().getFullYear();
      for (let i = currentYear; i >= 1980; i--) {
        years.push(i);
      }
      return years;
    };

    const getDaysInMonth = (month: number, year: number) => {
      return new Date(year, month + 1, 0).getDate();
    };

    const generateDays = () => {
      const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
      const days = [];
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
      }
      return days;
    };

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const handleConfirm = () => {
      const newDate = new Date(selectedYear, selectedMonth, selectedDay);
      onSelect(newDate);
      setVisible(false);
    };

    return (
      <View style={{ marginBottom: 20 }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#2D5A66',
            borderRadius: 8,
            paddingVertical: 15,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: '#4A9BB7',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          onPress={() => setVisible(!isVisible)}
        >
          <Text style={{
            color: value ? '#FFFFFF' : '#B0B0B0',
            fontSize: 16,
            fontFamily: "Inder",
            includeFontPadding: false,
          }}>
            {value ? formatDate(value) : placeholder}
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 16 }}>
            {isVisible ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        
        {isVisible && (
          <Modal
            transparent={true}
            visible={isVisible}
            animationType="fade"
            onRequestClose={() => setVisible(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => setVisible(false)}
            >
              <View style={{
                backgroundColor: '#1C3A42',
                borderRadius: 12,
                padding: 20,
                width: '90%',
                maxWidth: 400,
                borderWidth: 1,
                borderColor: '#4A9BB7',
              }}>
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 20,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  marginBottom: 20,
                  fontFamily: "Inder",
                }}>
                  Select Birth Date
                </Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                  {/* Month Picker */}
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ color: '#FFFFFF', marginBottom: 10, textAlign: 'center', fontFamily: "Inder" }}>Month</Text>
                    <ScrollView style={{ maxHeight: 150, backgroundColor: '#2D5A66', borderRadius: 8 }}>
                      {months.map((month, index) => (
                        <TouchableOpacity
                          key={index}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 10,
                            backgroundColor: selectedMonth === index ? '#4A9BB7' : 'transparent',
                          }}
                          onPress={() => setSelectedMonth(index)}
                        >
                          <Text style={{
                            color: '#FFFFFF',
                            textAlign: 'center',
                            fontFamily: "Inder",
                            fontWeight: selectedMonth === index ? 'bold' : 'normal',
                          }}>
                            {month}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  
                  {/* Day Picker */}
                  <View style={{ flex: 0.6, marginRight: 10 }}>
                    <Text style={{ color: '#FFFFFF', marginBottom: 10, textAlign: 'center', fontFamily: "Inder" }}>Day</Text>
                    <ScrollView style={{ maxHeight: 150, backgroundColor: '#2D5A66', borderRadius: 8 }}>
                      {generateDays().map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 10,
                            backgroundColor: selectedDay === day ? '#4A9BB7' : 'transparent',
                          }}
                          onPress={() => setSelectedDay(day)}
                        >
                          <Text style={{
                            color: '#FFFFFF',
                            textAlign: 'center',
                            fontFamily: "Inder",
                            fontWeight: selectedDay === day ? 'bold' : 'normal',
                          }}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  
                  {/* Year Picker */}
                  <View style={{ flex: 0.8 }}>
                    <Text style={{ color: '#FFFFFF', marginBottom: 10, textAlign: 'center', fontFamily: "Inder" }}>Year</Text>
                    <ScrollView style={{ maxHeight: 150, backgroundColor: '#2D5A66', borderRadius: 8 }}>
                      {generateYears().map((year) => (
                        <TouchableOpacity
                          key={year}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 10,
                            backgroundColor: selectedYear === year ? '#4A9BB7' : 'transparent',
                          }}
                          onPress={() => setSelectedYear(year)}
                        >
                          <Text style={{
                            color: '#FFFFFF',
                            textAlign: 'center',
                            fontFamily: "Inder",
                            fontWeight: selectedYear === year ? 'bold' : 'normal',
                          }}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
                
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#666',
                      borderRadius: 8,
                      paddingVertical: 12,
                    }}
                    onPress={() => setVisible(false)}
                  >
                    <Text style={{
                      color: '#FFFFFF',
                      textAlign: 'center',
                      fontSize: 16,
                      fontFamily: "Inder",
                    }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#4A9BB7',
                      borderRadius: 8,
                      paddingVertical: 12,
                    }}
                    onPress={handleConfirm}
                  >
                    <Text style={{
                      color: '#FFFFFF',
                      textAlign: 'center',
                      fontSize: 16,
                      fontWeight: 'bold',
                      fontFamily: "Inder",
                    }}>
                      Confirm
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </View>
    );
  };
  const NumberPicker = ({
    value,
    placeholder,
    minValue,
    maxValue,
    onSelect,
    isVisible,
    setVisible,
    unit = ""
  }: {
    value: string;
    placeholder: string;
    minValue: number;
    maxValue: number;
    onSelect: (value: string) => void;
    isVisible: boolean;
    setVisible: (visible: boolean) => void;
    unit?: string;
  }) => {
    const generateNumbers = () => {
      const numbers = [];
      for (let i = minValue; i <= maxValue; i++) {
        numbers.push(i);
      }
      return numbers;
    };

    const numbers = generateNumbers();

    return (
      <View style={{ marginBottom: 20 }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#2D5A66',
            borderRadius: 8,
            paddingVertical: 15,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: '#4A9BB7',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          onPress={() => setVisible(!isVisible)}
        >
          <Text style={{
            color: value ? '#FFFFFF' : '#B0B0B0',
            fontSize: 16,
            fontFamily: "Inder",
            includeFontPadding: false,
          }}>
            {value ? `${value}${unit}` : placeholder}
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 16 }}>
            {isVisible ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        
        {isVisible && (
          <Modal
            transparent={true}
            visible={isVisible}
            animationType="fade"
            onRequestClose={() => setVisible(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => setVisible(false)}
            >
              <View style={{
                backgroundColor: '#1C3A42',
                borderRadius: 12,
                padding: 20,
                maxHeight: 400,
                width: '80%',
                borderWidth: 1,
                borderColor: '#4A9BB7',
              }}>
                <ScrollView style={{ maxHeight: 350 }}>
                  {numbers.map((number, index) => (
                    <TouchableOpacity
                      key={index}
                      style={{
                        paddingVertical: 15,
                        paddingHorizontal: 10,
                        borderBottomWidth: index < numbers.length - 1 ? 1 : 0,
                        borderBottomColor: '#335C67',
                      }}
                      onPress={() => {
                        onSelect(number.toString());
                        setVisible(false);
                      }}
                    >
                      <Text style={{
                        color: value === number.toString() ? '#4A9BB7' : '#FFFFFF',
                        fontSize: 16,
                        fontWeight: value === number.toString() ? 'bold' : 'normal',
                        textAlign: 'center',
                        fontFamily: "Inder",
                        includeFontPadding: false,
                      }}>
                        {number}{unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </View>
    );
  };

  // Custom Success Modal Component
  const SuccessModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showSuccessModal}
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.successModalContainer}>
          <View style={styles.modalIcon}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.successModalTitle}>Success!</Text>
          <Text style={styles.successModalMessage}>
            {successMessage}
          </Text>
          <TouchableOpacity
            style={styles.successModalButton}
            onPress={() => setShowSuccessModal(false)}
          >
            <Text style={styles.successModalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Custom Image Picker Modal Component
  const ImagePickerModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showImagePickerModal}
      onRequestClose={() => setShowImagePickerModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.imagePickerModalContainer}>
          <View style={styles.imagePickerIcon}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
          <Text style={styles.imagePickerTitle}>Update Photo</Text>
          <Text style={styles.imagePickerMessage}>
            Choose how you'd like to update the horse's photo
          </Text>
          
          <View style={styles.imagePickerButtons}>
            <TouchableOpacity
              style={styles.imagePickerButton}
              onPress={takePhoto}
            >
              <View style={styles.imagePickerButtonIcon}>
                <Text style={styles.imagePickerButtonEmoji}>📷</Text>
              </View>
              <Text style={styles.imagePickerButtonText}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.imagePickerButton}
              onPress={pickImageFromLibrary}
            >
              <View style={styles.imagePickerButtonIcon}>
                <Text style={styles.imagePickerButtonEmoji}>🖼️</Text>
              </View>
              <Text style={styles.imagePickerButtonText}>Choose from Library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.imagePickerButton, styles.cancelImageButton]}
              onPress={() => setShowImagePickerModal(false)}
            >
              <Text style={styles.cancelImageButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const deleteHorse = (horse: any) => {
    Alert.alert(
      "Delete Horse",
      `Are you sure you want to delete ${horse.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            const updatedHorses = horses.filter(h => h.id !== horse.id);
            setHorses(updatedHorses);
            setSuccessMessage(`${horse.name} has been deleted`);
            setShowSuccessModal(true);
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>My Horses</Text>
        </View>
      </SafeAreaView>

      <View style={styles.viewPort}>
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.horsesContainer}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsText}>You have {horses.length} horses</Text>
            </View>
            
            {horses.map((horse, index) => (
              <View style={styles.horseCard} key={horse.id}>
                <View style={styles.horseImageContainer}>
                  <Image
                    style={styles.horseImage}
                    resizeMode="cover"
                    source={horse.img}
                  />
                </View>
                
                <View style={styles.horseContent}>
                  <View style={styles.horseInfo}>
                    <Text style={styles.horseName}>{horse.name}</Text>
                    <View style={styles.horseDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Gender:</Text>
                        <Text style={styles.detailValue}>{horse.gender}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Born:</Text>
                        <Text style={styles.detailValue}>
                          {horse.birthDate 
                            ? new Date(horse.birthDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : horse.year
                          }
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Height:</Text>
                        <Text style={styles.detailValue}>{horse.height} cm</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Breed:</Text>
                        <Text style={styles.detailValue}>{horse.breed}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => openEditModal(horse)}
                    >
                      <Text style={styles.editButtonText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => deleteHorse(horse)}
                    >
                      <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
            
            {horses.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>🐴</Text>
                <Text style={styles.emptyStateText}>No horses yet!</Text>
                <Text style={styles.emptyStateSubtext}>
                  Add your first horse to get started.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Edit Horse Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Horse</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeEditModal}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Photo</Text>
                <View style={styles.imageContainer}>
                  <Image
                    style={styles.selectedImage}
                    source={editImage || editingHorse?.img}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.changePhotoButton}
                    onPress={() => setShowImagePickerModal(true)}
                  >
                    <View style={styles.cameraIconContainer}>
                      <Text style={styles.cameraIconText}>📷</Text>
                    </View>
                    <Text style={styles.changePhotoText}>Change Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Horse name"
                  placeholderTextColor="#999"
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="none"
                  keyboardType="default"
                  returnKeyType="next"
                  maxLength={50}
                  multiline={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gender</Text>
                <CustomDropdown
                  value={editGender}
                  placeholder="Select gender"
                  options={genderOptions}
                  onSelect={setEditGender}
                  isVisible={genderDropdownVisible}
                  setVisible={setGenderDropdownVisible}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Birth Date</Text>
                <DatePicker
                  value={editBirthDate}
                  placeholder="Select birth date"
                  onSelect={setEditBirthDate}
                  isVisible={datePickerVisible}
                  setVisible={setDatePickerVisible}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Height (cm)</Text>
                <NumberPicker
                  value={editHeight}
                  placeholder="Select height"
                  minValue={100}
                  maxValue={220}
                  onSelect={setEditHeight}
                  isVisible={heightPickerVisible}
                  setVisible={setHeightPickerVisible}
                  unit=" cm"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Breed</Text>
                <CustomDropdown
                  value={editBreed}
                  placeholder="Select breed"
                  options={breedOptions}
                  onSelect={setEditBreed}
                  isVisible={breedDropdownVisible}
                  setVisible={setBreedDropdownVisible}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeEditModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveHorseEdit}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <SuccessModal />
      
      {/* Image Picker Modal */}
      <ImagePickerModal />
    </View>
  );
};

const data = [
  {
    id: 0,
    name: "Favory Falkó",
    gender: "Gelding",
    year: 2012,
    birthDate: "2012-03-15T00:00:00.000Z",
    height: 168,
    breed: "Lipicai",
    img: require("../../assets/images/horses/falko.png"),
  },
  {
    id: 1,
    name: "Yamina",
    gender: "Mare", //többnek kell lennie mint 3 karakter, különben szétkúrja a flexboxot
    year: 2018,
    birthDate: "2018-06-22T00:00:00.000Z",
    height: 160,
    breed: "Magyar Sportló",
    img: require("../../assets/images/horses/yamina.png"),
  },
  {
    id: 2,
    name: "Éva-Mária",
    gender: "Mare",
    year: 2000,
    birthDate: "2000-09-08T00:00:00.000Z",
    height: 155,
    breed: "Shitlandi póni",
    img: require("../../assets/images/horses/pony.jpg"),
  },
  {
    id: 3,
    name: "Árpád-Viktor",
    gender: "Stallion",
    year: 1999,
    birthDate: "1999-12-01T00:00:00.000Z",
    height: 172,
    breed: "Magyar Sportló",
    img: require("../../assets/images/horses/random2.jpg"),
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#335C67",
  },
  safeArea: {
    backgroundColor: "#335C67",
    paddingBottom: 5,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: -20,
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    flex: 1,
    fontWeight: "600",
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 5,
    paddingTop: 30,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  horsesContainer: {
    paddingHorizontal: 20,
  },
  statsHeader: {
    alignItems: "center",
    marginBottom: 30,
    backgroundColor: "#E9F5F0",
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  statsText: {
    fontSize: 18,
    fontFamily: "Inder",
    color: "#335C67",
    fontWeight: "600",
  },
  horseCard: {
    backgroundColor: "#E9F5F0",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  horseImageContainer: {
    alignItems: "center",
    marginBottom: 15,
  },
  horseImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#335C67",
  },
  horseContent: {
    flex: 1,
  },
  horseInfo: {
    marginBottom: 20,
  },
  horseName: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#335C67",
    textAlign: "center",
    marginBottom: 15,
  },
  horseDetails: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailLabel: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#666",
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#335C67",
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 15,
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#335C67",
  },
  deleteButton: {
    backgroundColor: "#FF6B6B",
  },
  editButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateText: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 10,
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "95%",
    maxWidth: 500,
    maxHeight: "90%",
    minHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 25,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 26,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#335C67",
  },
  modalCloseButton: {
    backgroundColor: "#666",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalContent: {
    flex: 1,
    padding: 25,
  },
  inputGroup: {
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#335C67",
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 15,
    padding: 18,
    fontSize: 17,
    fontFamily: "Inder",
    backgroundColor: "#f9f9f9",
    color: "#333",
    minHeight: 55,
    textAlignVertical: "center",
    includeFontPadding: false,
    textAlign: "left",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 25,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  saveButton: {
    backgroundColor: "#335C67",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 17,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  // Success Modal styles
  successModalContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    maxWidth: 300,
    width: "90%",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  checkIcon: {
    fontSize: 40,
    color: "#fff",
    fontWeight: "bold",
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 10,
    fontFamily: "Inder",
  },
  successModalMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 22,
    fontFamily: "Inder",
  },
  successModalButton: {
    backgroundColor: "#335C67",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
    minWidth: 100,
  },
  successModalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: "Inder",
  },
  // Image Picker Modal styles
  imagePickerModalContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    maxWidth: 350,
    width: "90%",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  imagePickerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#335C67",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  cameraIcon: {
    fontSize: 40,
    color: "#fff",
  },
  imagePickerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 10,
    fontFamily: "Inder",
  },
  imagePickerMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 22,
    fontFamily: "Inder",
  },
  imagePickerButtons: {
    width: "100%",
    gap: 15,
  },
  imagePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#335C67",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imagePickerButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePickerButtonEmoji: {
    fontSize: 18,
  },
  imagePickerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    flex: 1,
  },
  cancelImageButton: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
  },
  cancelImageButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  // Image selector styles
  imageContainer: {
    alignItems: "center",
    gap: 15,
  },
  selectedImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#335C67",
  },
  changePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#335C67",
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cameraIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraIconText: {
    fontSize: 14,
  },
  changePhotoText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
});

export default MyHorsesScreen;
