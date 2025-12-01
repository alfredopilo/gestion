import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../utils/imageCompression';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import StudentWithdrawalModal from '../components/StudentWithdrawalModal';
import StudentReactivationModal from '../components/StudentReactivationModal';

const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileSections, setProfileSections] = useState([]);
  const [profileValues, setProfileValues] = useState({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showReactivationModal, setShowReactivationModal] = useState(false);
  const [reactivationMode, setReactivationMode] = useState('reactivate'); // 'reactivate' o 'transfer'
  const canManageProfileTemplate = ['ADMIN', 'SECRETARIA'].includes(user?.rol);
  const canEditProfileValues = canManageProfileTemplate || user?.rol === 'PROFESOR';

  useEffect(() => {
    fetchStudent();
  }, [id]);

  const fetchStudentProfile = async () => {
    try {
      setProfileLoading(true);
      const response = await api.get(`/student-profile/students/${id}`);
      const sections = response.data.sections || [];
      setProfileSections(sections);
      const initialValues = {};
      sections.forEach((section) => {
        section.campos.forEach((field) => {
          initialValues[field.id] = deserializeFieldValue(field);
        });
      });
      setProfileValues(initialValues);
    } catch (error) {
      console.error('Error al cargar la ficha del estudiante:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchStudent = async () => {
    try {
      const response = await api.get(`/students/${id}`);
      setStudent(response.data);
      await fetchStudentProfile();
    } catch (error) {
      console.error('Error al cargar estudiante:', error);
      toast.error('Error al cargar información del estudiante');
      navigate('/students');
    } finally {
      setLoading(false);
    }
  };

  const deserializeFieldValue = (field) => {
    const valor = field.valor;
    if (valor === null || valor === undefined) {
      if (field.tipo === 'MULTISELECT') return [];
      if (field.tipo === 'BOOLEAN') return false;
      return '';
    }

    switch (field.tipo) {
      case 'NUMBER':
        return valor === null || valor === undefined ? '' : valor;
      case 'DATE':
        return valor ? valor.substring(0, 10) : '';
      case 'BOOLEAN':
        return valor === true;
      case 'MULTISELECT':
        return Array.isArray(valor) ? valor : [];
      case 'IMAGE':
        // El valor puede ser una URL completa o solo el nombre del archivo
        // Si es solo el nombre, extraerlo de la URL si viene del backend
        if (typeof valor === 'string') {
          // Si ya es una URL completa, retornarla
          if (valor.startsWith('http://') || valor.startsWith('https://') || valor.startsWith('/api/')) {
            return valor;
          }
          // Si es solo el nombre del archivo, retornarlo tal cual (se construirá la URL al mostrar)
          return valor;
        }
        return '';
      default:
        return valor || '';
    }
  };

  const getFieldOptions = (field) => {
    const options = field.config?.options;
    if (Array.isArray(options)) {
      return options;
    }
    return [];
  };

  const handleValueChange = (fieldId, value) => {
    setProfileValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleImageUpload = async (fieldId, file) => {
    try {
      // Comprimir la imagen antes de subirla
      const compressedFile = await compressImage(file, 150);
      
      // Crear FormData para enviar el archivo
      const formData = new FormData();
      formData.append('image', compressedFile);
      
      // Subir la imagen
      const uploadResponse = await api.post('/student-profile/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Actualizar el valor del campo con el nombre del archivo
      handleValueChange(fieldId, uploadResponse.data.filename);
      toast.success('Imagen subida correctamente');
    } catch (error) {
      console.error('Error al subir imagen:', error);
      toast.error(error.response?.data?.error || 'Error al subir la imagen');
    }
  };

  const handleStartEditProfile = () => {
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    const resetValues = {};
    profileSections.forEach((section) => {
      section.campos.forEach((field) => {
        resetValues[field.id] = deserializeFieldValue(field);
      });
    });
    setProfileValues(resetValues);
    setIsEditingProfile(false);
  };

  const buildPayloadValues = () => {
    const payload = [];
    profileSections.forEach((section) => {
      section.campos.forEach((field) => {
        let value = profileValues[field.id];
        if (field.tipo === 'NUMBER') {
          value = value === '' ? null : Number(value);
        } else if (field.tipo === 'BOOLEAN') {
          value = !!value;
        } else if (field.tipo === 'MULTISELECT') {
          value = Array.isArray(value) ? value : [];
        } else if (field.tipo === 'DATE') {
          value = value || null;
        } else {
          value = value === '' ? null : value;
        }
        payload.push({
          fieldId: field.id,
          value,
        });
      });
    });
    return payload;
  };

  const handleSaveProfile = async () => {
    try {
      setProfileSaving(true);
      const values = buildPayloadValues();
      await api.put(`/student-profile/students/${id}`, { values });
      toast.success('Ficha del estudiante actualizada');
      setIsEditingProfile(false);
      fetchStudentProfile();
    } catch (error) {
      console.error('Error al guardar la ficha:', error);
      const message = error.response?.data?.error || 'Error al guardar la ficha';
      toast.error(message);
    } finally {
      setProfileSaving(false);
    }
  };

  const renderFieldInput = (field) => {
    const value = profileValues[field.id];

    switch (field.tipo) {
      case 'TEXTAREA':
        return (
          <textarea
            value={value}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          />
        );
      case 'NUMBER':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          />
        );
      case 'DATE':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          />
        );
      case 'SELECT': {
        const options = getFieldOptions(field);
        return (
          <select
            value={value || ''}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Seleccionar...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      }
      case 'MULTISELECT': {
        const options = getFieldOptions(field);
        return (
          <select
            multiple
            value={value}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
              handleValueChange(field.id, selected);
            }}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 min-h-[100px]"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      }
      case 'BOOLEAN':
        return (
          <label className="inline-flex items-center mt-2">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-primary-600"
              checked={!!value}
              onChange={(e) => handleValueChange(field.id, e.target.checked)}
            />
            <span className="ml-2 text-sm text-gray-600">Sí / No</span>
          </label>
        );
      case 'IMAGE':
        return (
          <div className="mt-1">
            {value && (
              <div className="mb-2">
                <img
                  src={
                    value.startsWith('http://') || value.startsWith('https://')
                      ? value
                      : value.startsWith('/api/')
                      ? `${import.meta.env.VITE_API_URL.replace('/api/v1', '')}${value}`
                      : `${import.meta.env.VITE_API_URL.replace('/api/v1', '')}/api/v1/student-profile/images/${value}`
                  }
                  alt={field.etiqueta}
                  className="max-w-full h-auto max-h-48 rounded-md border border-gray-300"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(field.id, file);
                  }
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              <span className="text-xs text-gray-500 mt-1 block">
                Máximo 150 KB. La imagen se comprimirá automáticamente.
              </span>
            </label>
          </div>
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          />
        );
    }
  };

  const formatFieldDisplay = (field) => {
    const value = field.valor;
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      return <span className="text-sm text-gray-400">Sin información</span>;
    }

    switch (field.tipo) {
      case 'BOOLEAN':
        return <span className="text-sm text-gray-700">{value ? 'Sí' : 'No'}</span>;
      case 'DATE':
        return (
          <span className="text-sm text-gray-700">
            {value ? format(new Date(value), 'dd/MM/yyyy') : 'Sin información'}
          </span>
        );
      case 'MULTISELECT':
        return <span className="text-sm text-gray-700">{value.join(', ')}</span>;
      case 'SELECT': {
        const option = getFieldOptions(field).find((opt) => opt.value === value);
        return <span className="text-sm text-gray-700">{option?.label || value}</span>;
      }
      case 'IMAGE':
        return value ? (
          <div className="mt-1">
            <img
              src={
                value.startsWith('http://') || value.startsWith('https://')
                  ? value
                  : value.startsWith('/api/')
                  ? `${import.meta.env.VITE_API_URL.replace('/api/v1', '')}${value}`
                  : `${import.meta.env.VITE_API_URL.replace('/api/v1', '')}/api/v1/student-profile/images/${value}`
              }
              alt={field.etiqueta}
              className="max-w-full h-auto max-h-48 rounded-md border border-gray-300"
              onError={(e) => {
                e.target.style.display = 'none';
                const errorSpan = e.target.nextElementSibling;
                if (errorSpan) errorSpan.style.display = 'block';
              }}
            />
            <span className="text-sm text-gray-400 hidden">Imagen no disponible</span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">Sin imagen</span>
        );
      default:
        return <span className="text-sm text-gray-700">{value}</span>;
    }
  };

  const renderFieldContent = (field) => {
    if (isEditingProfile && canEditProfileValues) {
      return renderFieldInput(field);
    }
    return formatFieldDisplay(field);
  };

  const generatePDF = async () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;
      let yPos = margin;

      // Función helper para agregar texto con line breaks
      const addWrappedText = (text, x, y, maxWidth, fontSize = 10) => {
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        return lines.length * (fontSize * 0.35); // Retorna altura aproximada en mm
      };

      // Función helper para agregar imagen al PDF
      const addImageToPDF = (imgData, x, y, width, height) => {
        try {
          doc.addImage(imgData, 'JPEG', x, y, width, height);
        } catch (error) {
          console.error('Error al agregar imagen:', error);
        }
      };

      // Obtener logo de la institución e imagen del estudiante
      let institutionLogo = null;
      let studentPhoto = null;

      try {
        // Obtener información de la institución activa
        const institutionRes = await api.get('/institutions/active');
        if (institutionRes.data?.logo) {
          institutionLogo = institutionRes.data.logo;
        }
      } catch (error) {
        console.log('No se pudo obtener el logo de la institución');
      }

      // Usar la foto de carnet del estudiante si existe
      if (student.fotoCarnet) {
        studentPhoto = student.fotoCarnet;
      } else {
        // Buscar campo de foto en el perfil del estudiante como alternativa
        profileSections.forEach((section) => {
          section.campos.forEach((field) => {
            if (field.tipo === 'IMAGE' && field.valor && !studentPhoto) {
              // Tomar la primera imagen encontrada como foto del estudiante
              studentPhoto = field.valor;
            }
          });
        });
      }

      // Encabezado con logo y título
      doc.setFillColor(59, 130, 246); // primary-600
      doc.rect(0, 0, pageWidth, 25, 'F');
      
      // Logo de la institución (si existe)
      if (institutionLogo) {
        try {
          addImageToPDF(institutionLogo, margin, 5, 20, 15);
        } catch (error) {
          console.log('Error al cargar logo');
        }
      }
      
      // Título
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('FICHA DEL ESTUDIANTE', pageWidth / 2, 15, { align: 'center' });
      
      yPos = 30;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');

      // Sección de información principal con foto
      const photoWidth = 35;
      const photoHeight = 45;
      const photoX = pageWidth - margin - photoWidth;
      const photoY = yPos;
      const infoWidth = pageWidth - 2 * margin - photoWidth - 5;

      // Agregar foto del estudiante (si existe)
      if (studentPhoto) {
        try {
          let photoUrl = studentPhoto;
          if (!photoUrl.startsWith('http://') && !photoUrl.startsWith('https://') && !photoUrl.startsWith('data:')) {
            if (photoUrl.startsWith('/api/')) {
              photoUrl = `${import.meta.env.VITE_API_URL.replace('/api/v1', '')}${photoUrl}`;
            } else if (student.fotoCarnet && photoUrl === student.fotoCarnet) {
              // Si es la foto de carnet, usar el endpoint correcto
              photoUrl = `${import.meta.env.VITE_API_URL.replace('/api/v1', '')}/api/v1/students/foto/${photoUrl}`;
            } else {
              photoUrl = `${import.meta.env.VITE_API_URL.replace('/api/v1', '')}/api/v1/student-profile/images/${photoUrl}`;
            }
          }
          
          // Cargar y agregar la imagen
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          await new Promise((resolve, reject) => {
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imgData = canvas.toDataURL('image/jpeg', 0.8);
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.5);
                doc.rect(photoX, photoY, photoWidth, photoHeight);
                addImageToPDF(imgData, photoX, photoY, photoWidth, photoHeight);
                resolve();
              } catch (error) {
                reject(error);
              }
            };
            img.onerror = reject;
            img.src = photoUrl;
            setTimeout(reject, 3000); // timeout de 3 segundos
          });
        } catch (error) {
          console.log('Error al cargar foto del estudiante:', error);
          // Dibujar marco vacío si falla
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.5);
          doc.rect(photoX, photoY, photoWidth, photoHeight);
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text('Foto no', photoX + photoWidth / 2, photoY + photoHeight / 2 - 2, { align: 'center' });
          doc.text('disponible', photoX + photoWidth / 2, photoY + photoHeight / 2 + 2, { align: 'center' });
          doc.setTextColor(0, 0, 0);
        }
      } else {
        // Dibujar marco para foto si no existe
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(photoX, photoY, photoWidth, photoHeight);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Sin foto', photoX + photoWidth / 2, photoY + photoHeight / 2, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }

      // Información del estudiante al lado de la foto
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(`${student.user?.nombre || ''} ${student.user?.apellido || ''}`, margin, yPos + 6);
      
      yPos += 12;
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(55, 65, 81); // gray-700

      // Información básica al lado de la foto
      let infoY = yPos;
      const infoX = margin;

      // Email
      if (student.user?.email) {
        doc.setFont(undefined, 'bold');
        doc.text('Email:', infoX, infoY);
        doc.setFont(undefined, 'normal');
        const emailHeight = addWrappedText(student.user.email, infoX, infoY + 3.5, infoWidth, 9);
        infoY += emailHeight + 6;
      }

      // Teléfono
      if (student.user?.telefono) {
        doc.setFont(undefined, 'bold');
        doc.text('Teléfono:', infoX, infoY);
        doc.setFont(undefined, 'normal');
        doc.text(student.user.telefono, infoX, infoY + 3.5);
        infoY += 7.5;
      }

      // Matrícula
      if (student.matricula) {
        doc.setFont(undefined, 'bold');
        doc.text('Matrícula:', infoX, infoY);
        doc.setFont(undefined, 'normal');
        doc.text(student.matricula, infoX, infoY + 3.5);
        infoY += 7.5;
      }

      // Fecha de Nacimiento
      if (student.fechaNacimiento) {
        doc.setFont(undefined, 'bold');
        doc.text('Fecha de Nacimiento:', infoX, infoY);
        doc.setFont(undefined, 'normal');
        const fechaText = new Date(student.fechaNacimiento).toLocaleDateString('es-ES', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        const fechaHeight = addWrappedText(fechaText, infoX, infoY + 3.5, infoWidth, 9);
        infoY += fechaHeight + 6;
      }

      // Dirección
      if (student.user?.direccion) {
        doc.setFont(undefined, 'bold');
        doc.text('Dirección:', infoX, infoY);
        doc.setFont(undefined, 'normal');
        const direccionHeight = addWrappedText(student.user.direccion, infoX, infoY + 3.5, infoWidth, 9);
        infoY += direccionHeight + 6;
      }

      // Continuar después de la foto y la información
      yPos = Math.max(infoY, photoY + photoHeight) + 5;

      // Definir anchos de columna para las siguientes secciones
      const colWidth = (pageWidth - 2 * margin) / 2;
      const col1X = margin + 5;
      const col2X = margin + colWidth + 5;

      // Sección: Información del Grupo
      if (student.grupo) {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFillColor(243, 244, 246);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text('Información del Grupo', margin + 3, yPos + 5.5);
        yPos += 12;

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');

        let grupoCol1Y = yPos;
        let grupoCol2Y = yPos;
        let grupoCurrentCol = 1;

        if (student.grupo.nombre) {
          doc.setFont(undefined, 'bold');
          doc.text('Nombre:', col1X, grupoCol1Y);
          doc.setFont(undefined, 'normal');
          doc.text(student.grupo.nombre, col1X, grupoCol1Y + 3.5);
          grupoCol1Y += 7.5;
          grupoCurrentCol = 2;
        }

        if (student.grupo.nivel) {
          doc.setFont(undefined, 'bold');
          doc.text('Nivel:', col2X, grupoCol2Y);
          doc.setFont(undefined, 'normal');
          doc.text(student.grupo.nivel, col2X, grupoCol2Y + 3.5);
          grupoCol2Y += 7.5;
          grupoCurrentCol = 1;
        }

        if (student.grupo.paralelo) {
          const xPos = grupoCurrentCol === 1 ? col1X : col2X;
          const yPosCol = grupoCurrentCol === 1 ? grupoCol1Y : grupoCol2Y;
          doc.setFont(undefined, 'bold');
          doc.text('Paralelo:', xPos, yPosCol);
          doc.setFont(undefined, 'normal');
          doc.text(student.grupo.paralelo, xPos, yPosCol + 3.5);
          if (grupoCurrentCol === 1) {
            grupoCol1Y += 7.5;
            grupoCurrentCol = 2;
          } else {
            grupoCol2Y += 7.5;
            grupoCurrentCol = 1;
          }
        }

        if (student.grupo.docente?.user) {
          const xPos = grupoCurrentCol === 1 ? col1X : col2X;
          const yPosCol = grupoCurrentCol === 1 ? grupoCol1Y : grupoCol2Y;
          doc.setFont(undefined, 'bold');
          doc.text('Docente:', xPos, yPosCol);
          doc.setFont(undefined, 'normal');
          const docenteText = `${student.grupo.docente.user.nombre} ${student.grupo.docente.user.apellido}`;
          const docenteHeight = addWrappedText(docenteText, xPos, yPosCol + 3.5, colWidth - 10, 9);
          if (grupoCurrentCol === 1) {
            grupoCol1Y += docenteHeight + 6;
          } else {
            grupoCol2Y += docenteHeight + 6;
          }
        }

        yPos = Math.max(grupoCol1Y, grupoCol2Y) + 5;
      }

      // Información del Representante
      if (student.representante) {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFillColor(243, 244, 246);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text('Información del Representante', margin + 3, yPos + 5.5);
        yPos += 12;

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');

        let repCol1Y = yPos;
        let repCol2Y = yPos;
        let repCurrentCol = 1;

        if (student.representante.user) {
          doc.setFont(undefined, 'bold');
          doc.text('Nombre:', col1X, repCol1Y);
          doc.setFont(undefined, 'normal');
          const nombreText = `${student.representante.user.nombre} ${student.representante.user.apellido}`;
          const nombreHeight = addWrappedText(nombreText, col1X, repCol1Y + 3.5, colWidth - 10, 9);
          repCol1Y += nombreHeight + 6;
          repCurrentCol = 2;

          if (student.representante.user.email) {
            doc.setFont(undefined, 'bold');
            doc.text('Email:', col2X, repCol2Y);
            doc.setFont(undefined, 'normal');
            const emailHeight = addWrappedText(student.representante.user.email, col2X, repCol2Y + 3.5, colWidth - 10, 9);
            repCol2Y += emailHeight + 6;
            repCurrentCol = 1;
          }

          if (student.representante.user.telefono) {
            const xPos = repCurrentCol === 1 ? col1X : col2X;
            const yPosCol = repCurrentCol === 1 ? repCol1Y : repCol2Y;
            doc.setFont(undefined, 'bold');
            doc.text('Teléfono:', xPos, yPosCol);
            doc.setFont(undefined, 'normal');
            doc.text(student.representante.user.telefono, xPos, yPosCol + 3.5);
            if (repCurrentCol === 1) {
              repCol1Y += 7.5;
              repCurrentCol = 2;
            } else {
              repCol2Y += 7.5;
              repCurrentCol = 1;
            }
          }
        }

        if (student.representante.parentesco) {
          const xPos = repCurrentCol === 1 ? col1X : col2X;
          const yPosCol = repCurrentCol === 1 ? repCol1Y : repCol2Y;
          doc.setFont(undefined, 'bold');
          doc.text('Parentesco:', xPos, yPosCol);
          doc.setFont(undefined, 'normal');
          doc.text(student.representante.parentesco, xPos, yPosCol + 3.5);
          if (repCurrentCol === 1) {
            repCol1Y += 7.5;
          } else {
            repCol2Y += 7.5;
          }
        }

        yPos = Math.max(repCol1Y, repCol2Y) + 5;
      }

      // Ficha del Estudiante (campos personalizados)
      if (profileSections.length > 0) {
        profileSections.forEach((section) => {
          if (yPos > pageHeight - 50) {
            doc.addPage();
            yPos = margin;
          }

          // Título de la sección
          doc.setFillColor(243, 244, 246);
          doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(31, 41, 55);
          doc.text(section.nombre, margin + 3, yPos + 5.5);
          yPos += 12;

          if (section.descripcion) {
            doc.setFontSize(9);
            doc.setFont(undefined, 'italic');
            doc.setTextColor(107, 114, 128);
            const descHeight = addWrappedText(section.descripcion, margin + 5, yPos, pageWidth - 2 * margin - 10, 9);
            yPos += descHeight + 3;
          }

          doc.setFontSize(9);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(55, 65, 81);

          // Organizar campos en dos columnas
          let fieldCol1Y = yPos;
          let fieldCol2Y = yPos;
          let fieldCurrentCol = 1;

          section.campos.forEach((field, index) => {
            // Omitir el campo de foto que ya se mostró arriba
            if (field.tipo === 'IMAGE' && field.valor === studentPhoto) {
              return;
            }

            const valor = field.valor;
            let displayValue = '';

            // Formatear el valor según el tipo
            if (valor === null || valor === undefined || valor === '' || 
                (Array.isArray(valor) && valor.length === 0)) {
              displayValue = 'Sin información';
            } else {
              switch (field.tipo) {
                case 'BOOLEAN':
                  displayValue = valor ? 'Sí' : 'No';
                  break;
                case 'DATE':
                  displayValue = valor ? format(new Date(valor), 'dd/MM/yyyy') : 'Sin información';
                  break;
                case 'MULTISELECT':
                  displayValue = valor.join(', ');
                  break;
                case 'SELECT': {
                  const option = getFieldOptions(field).find((opt) => opt.value === valor);
                  displayValue = option?.label || valor;
                  break;
                }
                case 'IMAGE':
                  displayValue = valor ? '(Otra imagen adjunta)' : 'Sin imagen';
                  break;
                default:
                  displayValue = String(valor);
              }
            }

            // Determinar si el campo debe ocupar toda la línea (para campos largos tipo textarea)
            const isLongField = field.tipo === 'TEXTAREA' || displayValue.length > 50;
            
            if (isLongField) {
              // Ocupar todo el ancho
              const currentY = Math.max(fieldCol1Y, fieldCol2Y);
              
              if (currentY > pageHeight - 20) {
                doc.addPage();
                fieldCol1Y = margin;
                fieldCol2Y = margin;
              }

              doc.setFont(undefined, 'bold');
              doc.text(`${field.etiqueta}:`, col1X, currentY);
              doc.setFont(undefined, 'normal');
              const valueHeight = addWrappedText(displayValue, col1X, currentY + 3.5, pageWidth - 2 * margin - 10, 9);
              fieldCol1Y = currentY + valueHeight + 8;
              fieldCol2Y = fieldCol1Y;
              fieldCurrentCol = 1;
            } else {
              // Usar columnas
              const xPos = fieldCurrentCol === 1 ? col1X : col2X;
              const yPosCol = fieldCurrentCol === 1 ? fieldCol1Y : fieldCol2Y;

              if (yPosCol > pageHeight - 20) {
                doc.addPage();
                fieldCol1Y = margin;
                fieldCol2Y = margin;
                fieldCurrentCol = 1;
                const newXPos = col1X;
                const newYPos = fieldCol1Y;
                
                doc.setFont(undefined, 'bold');
                doc.text(`${field.etiqueta}:`, newXPos, newYPos);
                doc.setFont(undefined, 'normal');
                const valueHeight = addWrappedText(displayValue, newXPos, newYPos + 3.5, colWidth - 10, 9);
                fieldCol1Y += valueHeight + 8;
                fieldCurrentCol = 2;
              } else {
                doc.setFont(undefined, 'bold');
                doc.text(`${field.etiqueta}:`, xPos, yPosCol);
                doc.setFont(undefined, 'normal');
                const valueHeight = addWrappedText(displayValue, xPos, yPosCol + 3.5, colWidth - 10, 9);
                
                if (fieldCurrentCol === 1) {
                  fieldCol1Y += valueHeight + 8;
                  fieldCurrentCol = 2;
                } else {
                  fieldCol2Y += valueHeight + 8;
                  fieldCurrentCol = 1;
                }
              }
            }
          });

          yPos = Math.max(fieldCol1Y, fieldCol2Y) + 5;
        });
      }

      // Pie de página con fecha
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175); // gray-400
        doc.text(
          `Generado el ${new Date().toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })} - Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // Guardar el PDF
      doc.save(`Ficha_${student.user?.nombre}_${student.user?.apellido}.pdf`);
      toast.success('PDF generado exitosamente');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando información...</span>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Estudiante no encontrado</p>
        <button
          onClick={() => navigate('/students')}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Volver a estudiantes
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/students')}
            className="text-primary-600 hover:text-primary-700 mb-2 block"
          >
            ← Volver a estudiantes
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {student.user?.nombre} {student.user?.apellido}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {canManageProfileTemplate && (
            <>
              {student.retirado ? (
                <>
                  <button
                    onClick={() => {
                      setReactivationMode('reactivate');
                      setShowReactivationModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  >
                    <span>🔄</span> Reactivar
                  </button>
                  <button
                    onClick={() => {
                      setReactivationMode('transfer');
                      setShowReactivationModal(true);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                  >
                    <span>↗️</span> Transferir
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowWithdrawalModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                >
                  <span>❌</span> Retirar
                </button>
              )}
            </>
          )}
          <button
            onClick={generatePDF}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z"
                clipRule="evenodd"
              />
            </svg>
            Generar PDF
          </button>
          <Link
            to={`/historical-report-cards?estudianteId=${id}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span>📜</span>
            Boletines Históricos
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Información Personal */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Información Personal</h2>
            
            {/* Foto de Carnet */}
            <div className="mb-4 flex flex-col items-center">
              <div className="w-40 h-48 border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                {student.fotoCarnet ? (
                  <>
                    <img
                      src={`${import.meta.env.VITE_API_URL.replace('/api/v1', '')}/api/v1/students/foto/${student.fotoCarnet}`}
                      alt="Foto de carnet"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const placeholder = e.target.nextElementSibling;
                        if (placeholder) placeholder.style.display = 'flex';
                      }}
                    />
                    <div className="text-center text-gray-400 p-4 hidden">
                      <svg className="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      <p className="text-xs">Sin foto</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-400 p-4">
                    <svg className="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs">Sin foto</p>
                  </div>
                )}
              </div>
              
              {/* Input para subir foto */}
              {canEditProfileValues && (
                <div className="mt-3 w-full">
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            // Comprimir la imagen antes de subirla
                            const compressedFile = await compressImage(file, 150);
                            
                            // Crear FormData para enviar el archivo
                            const formData = new FormData();
                            formData.append('foto', compressedFile);
                            
                            // Subir la imagen (no establecer Content-Type manualmente, el navegador lo hace automáticamente)
                            await api.post(`/students/${id}/foto`, formData);
                            
                            toast.success('Foto de carnet actualizada');
                            fetchStudent(); // Recargar datos del estudiante
                          } catch (error) {
                            console.error('Error al subir foto:', error);
                            toast.error(error.response?.data?.error || 'Error al subir la foto');
                          }
                        }
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    <span className="text-xs text-gray-500 mt-1 block">
                      Máximo 150 KB. Se comprimirá automáticamente.
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-900">{student.user?.email || '-'}</p>
              </div>
              {student.user?.telefono && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                  <p className="mt-1 text-gray-900">{student.user.telefono}</p>
                </div>
              )}
              {student.user?.direccion && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dirección</label>
                  <p className="mt-1 text-gray-900">{student.user.direccion}</p>
                </div>
              )}
              {student.matricula && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Matrícula</label>
                  <p className="mt-1 text-gray-900">{student.matricula}</p>
                </div>
              )}
              {student.fechaNacimiento && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha de Nacimiento</label>
                  <p className="mt-1 text-gray-900">
                    {new Date(student.fechaNacimiento).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Información del Grupo */}
          {student.grupo && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Grupo</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <p className="mt-1 text-gray-900">{student.grupo.nombre}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nivel</label>
                  <p className="mt-1 text-gray-900">{student.grupo.nivel}</p>
                </div>
                {student.grupo.paralelo && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Paralelo</label>
                    <p className="mt-1 text-gray-900">{student.grupo.paralelo}</p>
                  </div>
                )}
                {student.grupo.docente && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Docente</label>
                    <p className="mt-1 text-gray-900">
                      {student.grupo.docente.user?.nombre} {student.grupo.docente.user?.apellido}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Representante */}
          {student.representante && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Representante</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <p className="mt-1 text-gray-900">
                    {student.representante.user?.nombre} {student.representante.user?.apellido}
                  </p>
                </div>
                {student.representante.user?.email && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-gray-900">{student.representante.user.email}</p>
                  </div>
                )}
                {student.representante.user?.telefono && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                    <p className="mt-1 text-gray-900">{student.representante.user.telefono}</p>
                  </div>
                )}
                {student.representante.parentesco && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Parentesco</label>
                    <p className="mt-1 text-gray-900">{student.representante.parentesco}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Calificaciones y Asistencias */}
        <div className="lg:col-span-2">
          {/* Ficha del Estudiante */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-semibold">Ficha del Estudiante</h2>
                <p className="text-sm text-gray-500">
                  Crea secciones personalizadas para registrar información adicional.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManageProfileTemplate && (
                  <button
                    onClick={() => navigate('/student-profile-template')}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                  >
                    Gestionar plantilla
                  </button>
                )}
                {profileSections.length > 0 && canEditProfileValues && (
                  <>
                    {isEditingProfile ? (
                      <>
                        <button
                          onClick={handleCancelEditProfile}
                          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                          disabled={profileSaving}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveProfile}
                          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm disabled:opacity-50"
                          disabled={profileSaving}
                        >
                          {profileSaving ? 'Guardando...' : 'Guardar ficha'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleStartEditProfile}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
                      >
                        Editar ficha
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {profileLoading ? (
              <div className="flex items-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mr-3"></div>
                <span className="text-gray-600">Cargando ficha del estudiante...</span>
              </div>
            ) : profileSections.length === 0 ? (
              <div className="text-gray-500 text-sm">
                No hay secciones configuradas para la ficha del estudiante.
                {canManageProfileTemplate && (
                  <button
                    onClick={() => navigate('/student-profile-template')}
                    className="text-primary-600 underline ml-1"
                  >
                    Crea la primera sección.
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {profileSections.map((section) => (
                  <div key={section.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">{section.nombre}</h3>
                      {section.descripcion && (
                        <p className="text-sm text-gray-500 mt-1">{section.descripcion}</p>
                      )}
                    </div>
                    {section.campos.length === 0 ? (
                      <p className="text-sm text-gray-400">No hay campos en esta sección.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {section.campos.map((field) => (
                          <div key={field.id}>
                            <label className="block text-sm font-medium text-gray-700">
                              {field.etiqueta}
                              {field.requerido && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {renderFieldContent(field)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calificaciones */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Calificaciones</h2>
            {student.calificaciones && student.calificaciones.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Materia
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Calificación
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Observaciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {student.calificaciones.map((calificacion) => (
                      <tr key={calificacion.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {calificacion.materia?.nombre || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold">
                          {calificacion.calificacion || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {calificacion.fechaRegistro
                            ? format(new Date(calificacion.fechaRegistro), 'dd/MM/yyyy')
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {calificacion.observaciones || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No hay calificaciones registradas</p>
            )}
          </div>

          {/* Asistencias */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Últimas Asistencias</h2>
            {student.asistencias && student.asistencias.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Observaciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {student.asistencias.map((asistencia) => (
                      <tr key={asistencia.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {asistencia.fecha
                            ? format(new Date(asistencia.fecha), 'dd/MM/yyyy')
                            : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              asistencia.estado === 'ASISTENCIA'
                                ? 'bg-green-100 text-green-800'
                                : asistencia.estado === 'FALTA'
                                ? 'bg-red-100 text-red-800'
                                : asistencia.estado === 'JUSTIFICADA'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {asistencia.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {asistencia.observaciones || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No hay asistencias registradas</p>
            )}
          </div>

          {/* Pagos */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Pagos</h2>
            {student.pagos && student.pagos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Concepto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Monto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {student.pagos.map((pago) => (
                      <tr key={pago.id}>
                        <td className="px-4 py-3 whitespace-nowrap">{pago.concepto || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          ${pago.monto ? pago.monto.toFixed(2) : '0.00'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              pago.estado === 'PAGADO'
                                ? 'bg-green-100 text-green-800'
                                : pago.estado === 'PENDIENTE'
                                ? 'bg-yellow-100 text-yellow-800'
                                : pago.estado === 'VENCIDO'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {pago.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {pago.createdAt
                            ? format(new Date(pago.createdAt), 'dd/MM/yyyy')
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No hay pagos registrados</p>
            )}
          </div>
        </div>
      </div>

      {/* Modales */}
      {showWithdrawalModal && student && (
        <StudentWithdrawalModal
          student={student}
          onClose={() => setShowWithdrawalModal(false)}
          onSuccess={() => {
            fetchStudent();
            setShowWithdrawalModal(false);
          }}
        />
      )}

      {showReactivationModal && student && (
        <StudentReactivationModal
          student={{ ...student, reactivationMode }}
          onClose={() => {
            setShowReactivationModal(false);
            setReactivationMode('reactivate');
          }}
          onSuccess={() => {
            fetchStudent();
            setShowReactivationModal(false);
            setReactivationMode('reactivate');
          }}
        />
      )}
    </div>
  );
};

export default StudentDetail;

