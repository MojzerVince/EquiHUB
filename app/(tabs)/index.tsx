import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { HorseAPI } from "../../lib/horseAPI";
import { Horse } from "../../lib/supabase";

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
  const { user, loading: authLoading } = useAuth();
  const { currentTheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(false);
  const [horsesLoaded, setHorsesLoaded] = useState(false);
  
  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingHorse, setEditingHorse] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editHeight, setEditHeight] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editBirthDate, setEditBirthDate] = useState<Date | null>(null);

  // Add horse modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addName, setAddName] = useState("");
  const [addGender, setAddGender] = useState("");
  const [addHeight, setAddHeight] = useState("");
  const [addWeight, setAddWeight] = useState("");
  const [addBreed, setAddBreed] = useState("");
  const [addBirthDate, setAddBirthDate] = useState<Date | null>(null);
  const [addImage, setAddImage] = useState<any>(null);

  // Dropdown state
  const [genderDropdownVisible, setGenderDropdownVisible] = useState(false);
  const [breedDropdownVisible, setBreedDropdownVisible] = useState(false);
  
  // Add modal dropdown state
  const [addGenderDropdownVisible, setAddGenderDropdownVisible] = useState(false);
  const [addBreedDropdownVisible, setAddBreedDropdownVisible] = useState(false);
  
  // Number picker state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [heightPickerVisible, setHeightPickerVisible] = useState(false);
  
  // Add modal picker state
  const [addDatePickerVisible, setAddDatePickerVisible] = useState(false);
  const [addHeightPickerVisible, setAddHeightPickerVisible] = useState(false);
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  // Image picker state
  const [editImage, setEditImage] = useState<any>(null);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);

  // Load horses when user is authenticated
  useEffect(() => {
    // Add a timeout to prevent getting stuck in loading state
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 15000); // 15 second timeout

    if (!authLoading && user?.id && !loading && !horsesLoaded) {
      loadHorses(user.id);
    } else if (!authLoading && !user?.id) {
      // User is not authenticated, set loading to false
      setLoading(false);
      setHorsesLoaded(false);
    }

    return () => {
      clearTimeout(loadingTimeout);
    };
  }, [user, authLoading, loading, horsesLoaded]);

  const loadHorses = async (userId: string) => {
    try {
      setLoading(true);
      
      // Add timeout to detect hanging API calls
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('API call timeout after 10 seconds')), 10000);
      });
      
      const apiPromise = HorseAPI.getHorses(userId);
      
      const horsesData = await Promise.race([apiPromise, timeoutPromise]);
      
      // Ensure we have valid array data
      if (Array.isArray(horsesData)) {
        setHorses(horsesData);
      } else {
        setHorses([]);
      }
      
      setHorsesLoaded(true);
      
    } catch (error) {
      console.error('Error loading horses:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Set empty array on error to prevent UI issues
      setHorses([]);
      setHorsesLoaded(true);
      
      if (errorMessage.includes('timeout')) {
        Alert.alert('Timeout', 'The request took too long. Please check your internet connection.');
      } else {
        Alert.alert('Error', 'Failed to load horses');
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    if (user?.id) {
      setRefreshing(true);
      setHorsesLoaded(false); // Reset the loaded flag to allow reloading
      await loadHorses(user.id);
      setRefreshing(false);
    }
  };

  const openEditModal = (horse: Horse) => {
    setEditingHorse(horse);
    setEditName(horse.name);
    setEditGender(horse.gender);
    setEditHeight(horse.height.toString());
    setEditWeight(horse.weight ? horse.weight.toString() : "");
    setEditBreed(horse.breed);
    // Check if image_url contains base64 data or is a regular URL
    setEditImage(horse.image_url ? { uri: horse.image_url } : null);
    
    // Set birth date
    if (horse.birth_date) {
      setEditBirthDate(new Date(horse.birth_date));
    } else {
      setEditBirthDate(null);
    }
    
    // Reset dropdown states
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
    setEditWeight("");
    setEditBreed("");
    setEditImage(null);
    setEditBirthDate(null);
    setGenderDropdownVisible(false);
    setBreedDropdownVisible(false);
    setDatePickerVisible(false);
    setHeightPickerVisible(false);
    setShowImagePickerModal(false);
  };

  const openAddModal = () => {
    setAddName("");
    setAddGender("");
    setAddHeight("");
    setAddWeight("");
    setAddBreed("");
    setAddBirthDate(null);
    setAddImage(null);
    setAddGenderDropdownVisible(false);
    setAddBreedDropdownVisible(false);
    setAddDatePickerVisible(false);
    setAddHeightPickerVisible(false);
    setShowImagePickerModal(false);
    setAddModalVisible(true);
  };

  const closeAddModal = () => {
    setAddModalVisible(false);
    setAddName("");
    setAddGender("");
    setAddHeight("");
    setAddWeight("");
    setAddBreed("");
    setAddBirthDate(null);
    setAddImage(null);
    setAddGenderDropdownVisible(false);
    setAddBreedDropdownVisible(false);
    setAddDatePickerVisible(false);
    setAddHeightPickerVisible(false);
    setShowImagePickerModal(false);
  };

  const saveHorseEdit = async () => {
    if (!user?.id || !editingHorse) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    // Validation logic (same as before)
    const normalizedName = editName.normalize('NFC').trim();
    const normalizedGender = editGender.normalize('NFC').trim();
    const normalizedBreed = editBreed.normalize('NFC').trim();
    const normalizedHeight = editHeight.trim();
    const normalizedWeight = editWeight.trim();

    if (!normalizedName || !normalizedGender || !editBirthDate || !normalizedHeight || !normalizedBreed) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const namePattern = /^[\p{L}\p{M}\s\-'\.]+$/u;
    if (!namePattern.test(normalizedName)) {
      Alert.alert("Error", "Horse name contains invalid characters");
      return;
    }

    if (normalizedName.length < 2 || normalizedName.length > 50) {
      Alert.alert("Error", "Horse name must be between 2 and 50 characters");
      return;
    }

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

    let weightNum = null; // Use null instead of undefined for proper deletion
    if (normalizedWeight) {
      weightNum = parseInt(normalizedWeight);
      if (isNaN(weightNum) || weightNum < 50 || weightNum > 2000) {
        Alert.alert("Error", "Please enter a valid weight (50-2000 kg)");
        return;
      }
    }

    try {
      setLoading(true);

      const updates = {
        name: normalizedName,
        gender: normalizedGender,
        birth_date: editBirthDate.toISOString(),
        height: heightNum,
        weight: weightNum, // This will be null if weight field is cleared
        breed: normalizedBreed,
        image: editImage && editImage.uri !== editingHorse.image_url ? editImage : undefined,
      };

      const updatedHorse = await HorseAPI.updateHorse(editingHorse.id, user?.id, updates);

      if (updatedHorse) {
        setHorsesLoaded(false); // Reset flag to allow reloading
        await loadHorses(user?.id);
        closeEditModal();
        
        // Check if image was provided but not saved
        if (editImage && editImage.uri !== editingHorse.image_url && !updatedHorse.image_url) {
          setSuccessMessage(`${normalizedName} has been updated! (Note: Image processing failed, but other changes were saved)`);
        } else {
          setSuccessMessage(`${normalizedName} has been updated!`);
        }
        setShowSuccessModal(true);
      } else {
        Alert.alert("Error", "Failed to update horse");
      }
    } catch (error) {
      console.error('Error updating horse:', error);
      Alert.alert("Error", "Failed to update horse");
    } finally {
      setLoading(false);
    }
  };

  const saveHorseAdd = async () => {
    if (!user?.id) {
      Alert.alert("Authentication Error", "Please log in again to add horses");
      return;
    }

    // Validation logic (same as before)
    const normalizedName = addName.normalize('NFC').trim();
    const normalizedGender = addGender.normalize('NFC').trim();
    const normalizedBreed = addBreed.normalize('NFC').trim();
    const normalizedHeight = addHeight.trim();
    const normalizedWeight = addWeight.trim();

    if (!normalizedName || !normalizedGender || !addBirthDate || !normalizedHeight || !normalizedBreed) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const namePattern = /^[\p{L}\p{M}\s\-'\.]+$/u;
    if (!namePattern.test(normalizedName)) {
      Alert.alert("Error", "Horse name contains invalid characters");
      return;
    }

    if (normalizedName.length < 2 || normalizedName.length > 50) {
      Alert.alert("Error", "Horse name must be between 2 and 50 characters");
      return;
    }

    const currentDate = new Date();
    const minDate = new Date(1980, 0, 1);
    if (addBirthDate < minDate || addBirthDate > currentDate) {
      Alert.alert("Error", "Please enter a valid birth date");
      return;
    }

    const heightNum = parseInt(normalizedHeight);
    if (isNaN(heightNum) || heightNum < 50 || heightNum > 250) {
      Alert.alert("Error", "Please enter a valid height (50-250 cm)");
      return;
    }

    let weightNum = null; // Use null instead of undefined for consistency
    if (normalizedWeight) {
      weightNum = parseInt(normalizedWeight);
      if (isNaN(weightNum) || weightNum < 50 || weightNum > 2000) {
        Alert.alert("Error", "Please enter a valid weight (50-2000 kg)");
        return;
      }
    }

    try {
      setLoading(true);

      const horseData = {
        name: normalizedName,
        gender: normalizedGender,
        birth_date: addBirthDate.toISOString(),
        height: heightNum,
        weight: weightNum,
        breed: normalizedBreed,
        image: addImage,
      };

      const newHorse = await HorseAPI.addHorse(user?.id, horseData);

      if (newHorse) {
        setHorsesLoaded(false); // Reset flag to allow reloading
        await loadHorses(user?.id);
        closeAddModal();
        
        // Check if image was provided but not saved
        if (addImage && !newHorse.image_url) {
          setSuccessMessage(`${normalizedName} has been added! (Note: Image processing failed, but horse was saved successfully)`);
        } else {
          setSuccessMessage(`${normalizedName} has been added!`);
        }
        setShowSuccessModal(true);
      } else {
        Alert.alert("Error", "Failed to add horse. Please try again.");
      }
    } catch (error) {
      console.error('Error adding horse:', error);
      Alert.alert("Error", "Failed to add horse. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteHorse = (horse: Horse) => {
    Alert.alert(
      "Delete Horse",
      `Are you sure you want to delete ${horse.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            if (!user?.id) {
              Alert.alert("Error", "User not authenticated");
              return;
            }

            try {
              setLoading(true);
              const success = await HorseAPI.deleteHorse(horse.id, user?.id);
              
              if (success) {
                setHorsesLoaded(false); // Reset flag to allow reloading
                await loadHorses(user?.id);
                setSuccessMessage(`${horse.name} has been deleted`);
                setShowSuccessModal(true);
              } else {
                Alert.alert("Error", "Failed to delete horse");
              }
            } catch (error) {
              console.error('Error deleting horse:', error);
              Alert.alert("Error", "Failed to delete horse");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
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
      const newImage = { uri: result.assets[0].uri };
      if (editModalVisible) {
        setEditImage(newImage);
      } else if (addModalVisible) {
        setAddImage(newImage);
      }
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
      const newImage = { uri: result.assets[0].uri };
      if (editModalVisible) {
        setEditImage(newImage);
      } else if (addModalVisible) {
        setAddImage(newImage);
      }
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
                backgroundColor: currentTheme.colors.card,
                borderRadius: 12,
                padding: 20,
                maxHeight: 300,
                width: '80%',
                borderWidth: 1,
                borderColor: currentTheme.colors.border,
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
                        color: value === option ? currentTheme.colors.secondary : '#FFFFFF',
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
                backgroundColor: currentTheme.colors.card,
                borderRadius: 12,
                padding: 20,
                width: '90%',
                maxWidth: 400,
                borderWidth: 1,
                borderColor: currentTheme.colors.border,
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

  // Custom Number Picker Component
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
    const [selectedValue, setSelectedValue] = useState(parseInt(value) || minValue);

    const generateNumbers = () => {
      const numbers = [];
      for (let i = minValue; i <= maxValue; i++) {
        numbers.push(i);
      }
      return numbers;
    };

    const handleConfirm = () => {
      onSelect(selectedValue.toString());
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
                width: '80%',
                maxWidth: 300,
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
                  Select {placeholder.toLowerCase()}
                </Text>
                
                <ScrollView style={{ maxHeight: 200, backgroundColor: '#2D5A66', borderRadius: 8 }}>
                  {generateNumbers().map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={{
                        paddingVertical: 15,
                        paddingHorizontal: 10,
                        backgroundColor: selectedValue === num ? '#4A9BB7' : 'transparent',
                        borderBottomWidth: 1,
                        borderBottomColor: '#335C67',
                      }}
                      onPress={() => setSelectedValue(num)}
                    >
                      <Text style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        textAlign: 'center',
                        fontFamily: "Inder",
                        fontWeight: selectedValue === num ? 'bold' : 'normal',
                      }}>
                        {num}{unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
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

  // Custom Success Modal Component
  const SuccessModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showSuccessModal}
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.successModalContainer, { backgroundColor: currentTheme.colors.surface }]}>
          <View style={[styles.modalIcon, { backgroundColor: currentTheme.colors.success }]}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={[styles.successModalTitle, { color: currentTheme.colors.text }]}>Success!</Text>
          <Text style={[styles.successModalMessage, { color: currentTheme.colors.textSecondary }]}>
            {successMessage}
          </Text>
          <TouchableOpacity
            style={[styles.successModalButton, { backgroundColor: currentTheme.colors.primary }]}
            onPress={() => setShowSuccessModal(false)}
          >
            <Text style={[styles.successModalButtonText, { color: '#FFFFFF' }]}>OK</Text>
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
        <View style={[styles.imagePickerModalContainer, { backgroundColor: currentTheme.colors.surface }]}>
          <View style={[styles.imagePickerIcon, { backgroundColor: currentTheme.colors.accent }]}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
          <Text style={[styles.imagePickerTitle, { color: currentTheme.colors.text }]}>Update Photo</Text>
          <Text style={[styles.imagePickerMessage, { color: currentTheme.colors.textSecondary }]}>
            Choose how you'd like to update the horse's photo
          </Text>
          
          <View style={styles.imagePickerButtons}>
            <TouchableOpacity
              style={[styles.imagePickerButton, { backgroundColor: currentTheme.colors.primary, borderColor: currentTheme.colors.border }]}
              onPress={takePhoto}
            >
              <View style={styles.imagePickerButtonIcon}>
                <Text style={styles.imagePickerButtonEmoji}>📷</Text>
              </View>
              <Text style={[styles.imagePickerButtonText, { color: '#FFFFFF' }]}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.imagePickerButton, { backgroundColor: currentTheme.colors.secondary, borderColor: currentTheme.colors.border }]}
              onPress={pickImageFromLibrary}
            >
              <View style={styles.imagePickerButtonIcon}>
                <Text style={styles.imagePickerButtonEmoji}>🖼️</Text>
              </View>
              <Text style={[styles.imagePickerButtonText, { color: '#FFFFFF' }]}>Choose from Library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.imagePickerButton, styles.cancelImageButton, { backgroundColor: currentTheme.colors.textSecondary }]}
              onPress={() => setShowImagePickerModal(false)}
            >
              <Text style={[styles.cancelImageButtonText, { color: '#FFFFFF' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Show authentication message if no user
  if (!authLoading && !user?.id) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.colors.primary }]}>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: currentTheme.colors.primary }]}>
          <View style={styles.headerContainer}>
            <Text style={styles.header}>My Horses</Text>
          </View>
        </SafeAreaView>
        <View style={[styles.viewPort, { backgroundColor: currentTheme.colors.background }]}>
          <View style={styles.loadingContainer}>
            <Text style={styles.emptyStateEmoji}>🔒</Text>
            <Text style={styles.emptyStateText}>Please log in</Text>
            <Text style={styles.emptyStateSubtext}>
              You need to be logged in to manage your horses.
            </Text>
            <TouchableOpacity
              style={styles.addHorseButton}
              onPress={() => user?.id && loadHorses(user.id)}
            >
              <Text style={styles.addHorseButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Add timeout fallback for auth loading
  useEffect(() => {
    const authTimeout = setTimeout(() => {
      if (authLoading) {
        // Auth loading timeout - just log for debugging
      }
    }, 20000); // 20 second timeout for auth

    return () => {
      clearTimeout(authTimeout);
    };
  }, [authLoading]);

  if (authLoading || loading) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.colors.primary }]}>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: currentTheme.colors.primary }]}>
          <View style={styles.headerContainer}>
            <Text style={styles.header}>My Horses</Text>
          </View>
        </SafeAreaView>
        <View style={[styles.viewPort, { backgroundColor: currentTheme.colors.background }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={currentTheme.colors.primary} />
            <Text style={styles.loadingText}>
              {authLoading ? "Loading..." : "Loading horses..."}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.primary }]}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: currentTheme.colors.primary }]}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>My Horses</Text>
        </View>
      </SafeAreaView>

      <View style={[styles.viewPort, { backgroundColor: currentTheme.colors.surface }]}>
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
      <View style={styles.horsesContainer}>
        <View style={[styles.statsHeader, { backgroundColor: currentTheme.colors.surface }]}>
          <Text style={[styles.statsText, { color: currentTheme.colors.text }]}>You have {horses.length} horses</Text>
        </View>
        
        <TouchableOpacity
          style={[styles.addHorseButton, { backgroundColor: currentTheme.colors.primary, borderColor: currentTheme.colors.border }]}
          onPress={openAddModal}
        >
          <Text style={styles.addHorseButtonIcon}>🐴</Text>
          <Text style={[styles.addHorseButtonText, { color: '#FFFFFF' }]}>Add New Horse</Text>
        </TouchableOpacity>            {horses.map((horse, index) => (
              <View style={[styles.horseCard, { backgroundColor: currentTheme.colors.background, borderColor: currentTheme.colors.border }]} key={horse.id}>
                <View style={styles.horseImageContainer}>
                  <Image
                    style={styles.horseImage}
                    resizeMode="cover"
                    source={
                      horse.image_url 
                        ? { uri: horse.image_url }
                        : require("../../assets/images/horses/pony.jpg")
                    }
                  />
                </View>
                
                <View style={styles.horseContent}>
                  <View style={styles.horseInfo}>
                    <Text style={[styles.horseName, { color: currentTheme.colors.text, fontSize: 20, fontWeight: 'bold' }]}>{horse.name}</Text>
                    <View style={styles.horseDetails}>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: currentTheme.colors.textSecondary, fontSize: 14 }]}>Gender:</Text>
                        <Text style={[styles.detailValue, { color: currentTheme.colors.text, fontSize: 14 }]}>{horse.gender}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: currentTheme.colors.textSecondary, fontSize: 14 }]}>Born:</Text>
                        <Text style={[styles.detailValue, { color: currentTheme.colors.text, fontSize: 14 }]}>
                          {formatDate(horse.birth_date)}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: currentTheme.colors.textSecondary, fontSize: 14 }]}>Height:</Text>
                        <Text style={[styles.detailValue, { color: currentTheme.colors.text, fontSize: 14 }]}>{horse.height} cm</Text>
                      </View>
                      {horse.weight && (
                        <View style={styles.detailRow}>
                          <Text style={[styles.detailLabel, { color: currentTheme.colors.textSecondary, fontSize: 14 }]}>Weight:</Text>
                          <Text style={[styles.detailValue, { color: currentTheme.colors.text, fontSize: 14 }]}>{horse.weight} kg</Text>
                        </View>
                      )}
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: currentTheme.colors.textSecondary, fontSize: 14 }]}>Breed:</Text>
                        <Text style={[styles.detailValue, { color: currentTheme.colors.text, fontSize: 14 }]}>{horse.breed}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton, { backgroundColor: currentTheme.colors.secondary }]}
                      onPress={() => openEditModal(horse)}
                    >
                      <Text style={[styles.editButtonText, { color: '#FFFFFF' }]}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton, { backgroundColor: currentTheme.colors.error }]}
                      onPress={() => deleteHorse(horse)}
                    >
                      <Text style={[styles.deleteButtonText, { color: '#FFFFFF' }]}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
            
            {horses.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>🐴</Text>
                <Text style={[styles.emptyStateText, { color: currentTheme.colors.text }]}>No horses yet!</Text>
                <Text style={[styles.emptyStateSubtext, { color: currentTheme.colors.textSecondary }]}>
                  Add your first horse to get started.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Loading overlay */}
      {loading && horses.length > 0 && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingModal, { backgroundColor: currentTheme.colors.surface }]}>
            <ActivityIndicator size="large" color={currentTheme.colors.primary} />
            <Text style={[styles.loadingModalText, { color: currentTheme.colors.text }]}>Updating...</Text>
          </View>
        </View>
      )}

      {/* Edit Horse Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: currentTheme.colors.surface }]}>
            <View style={[styles.modalHeader, { backgroundColor: currentTheme.colors.primary }]}>
              <Text style={[styles.modalTitle, { color: '#FFFFFF' }]}>Edit Horse</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeEditModal}
              >
                <Text style={[styles.modalCloseText, { color: '#FFFFFF' }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Photo</Text>
                <View style={styles.imageContainer}>
                  <Image
                    style={styles.selectedImage}
                    source={
                      editImage 
                        ? editImage
                        : editingHorse?.image_url 
                        ? { uri: editingHorse.image_url }
                        : require("../../assets/images/horses/pony.jpg")
                    }
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
                <Text style={[styles.inputLabel, { color: currentTheme.colors.text }]}>Name</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: currentTheme.colors.primaryDark, borderColor: currentTheme.colors.border, color: '#FFFFFF' }]}
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
                <TextInput
                  style={styles.textInput}
                  value={editHeight}
                  onChangeText={setEditHeight}
                  placeholder="Enter height (100-220 cm)"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  returnKeyType="next"
                  maxLength={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Weight (kg) - Optional</Text>
                <TextInput
                  style={styles.textInput}
                  value={editWeight}
                  onChangeText={setEditWeight}
                  placeholder="Enter weight"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  returnKeyType="next"
                  maxLength={4}
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
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: currentTheme.colors.textSecondary }]}
                onPress={closeEditModal}
              >
                <Text style={[styles.cancelButtonText, { color: '#FFFFFF' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: currentTheme.colors.primary }]}
                onPress={saveHorseEdit}
              >
                <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Horse Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addModalVisible}
        onRequestClose={closeAddModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: currentTheme.colors.surface }]}>
            <View style={[styles.modalHeader, { backgroundColor: currentTheme.colors.primary }]}>
              <Text style={[styles.modalTitle, { color: '#FFFFFF' }]}>Add New Horse</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeAddModal}
              >
                <Text style={[styles.modalCloseText, { color: '#FFFFFF' }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Photo</Text>
                <View style={styles.imageContainer}>
                  <Image
                    style={styles.selectedImage}
                    source={addImage || require("../../assets/images/horses/pony.jpg")}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.changePhotoButton}
                    onPress={() => setShowImagePickerModal(true)}
                  >
                    <View style={styles.cameraIconContainer}>
                      <Text style={styles.cameraIconText}>📷</Text>
                    </View>
                    <Text style={styles.changePhotoText}>Add Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={addName}
                  onChangeText={setAddName}
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
                  value={addGender}
                  placeholder="Select gender"
                  options={genderOptions}
                  onSelect={setAddGender}
                  isVisible={addGenderDropdownVisible}
                  setVisible={setAddGenderDropdownVisible}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Birth Date</Text>
                <DatePicker
                  value={addBirthDate}
                  placeholder="Select birth date"
                  onSelect={setAddBirthDate}
                  isVisible={addDatePickerVisible}
                  setVisible={setAddDatePickerVisible}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Height (cm)</Text>
                <TextInput
                  style={styles.textInput}
                  value={addHeight}
                  onChangeText={setAddHeight}
                  placeholder="Enter height (100-220 cm)"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  returnKeyType="next"
                  maxLength={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Weight (kg) - Optional</Text>
                <TextInput
                  style={styles.textInput}
                  value={addWeight}
                  onChangeText={setAddWeight}
                  placeholder="Enter weight"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  returnKeyType="next"
                  maxLength={4}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Breed</Text>
                <CustomDropdown
                  value={addBreed}
                  placeholder="Select breed"
                  options={breedOptions}
                  onSelect={setAddBreed}
                  isVisible={addBreedDropdownVisible}
                  setVisible={setAddBreedDropdownVisible}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeAddModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveHorseAdd}
              >
                <Text style={styles.saveButtonText}>Add Horse</Text>
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
    paddingTop: 20,
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
    marginBottom: 10,
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
  addHorseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#335C67",
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 25,
    marginTop: 10, // Add this line
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 10,
  },
  addHorseButtonIcon: {
    fontSize: 20,
  },
  addHorseButtonText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inder",
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
    shadowRadius: 4, // Complete this property
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#666",
    fontFamily: "Inder",
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingModal: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  loadingModalText: {
    marginTop: 10,
    fontSize: 16,
    color: '#335C67',
    fontFamily: 'Inder',
  },
});

export default MyHorsesScreen;
